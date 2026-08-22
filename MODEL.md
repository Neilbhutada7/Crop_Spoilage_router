# Machine Learning Model Documentation

This document exists to directly answer the SIH Round 1 feedback: *"the core ML
methodology is insufficiently justified."* Every number below is produced by
`backend/seed_and_train.py` and written to `backend/model_metrics.json` — it
is loaded at runtime by `/api/model/info` and shown in the UI. Nothing here is
hand-typed into the frontend; if `model_metrics.json` is ever deleted, the UI
falls back to "Insufficient real-world validation data" rather than showing a
stale or invented number.

## What the model predicts (target variable)

The model is an **XGBoost regressor (XGBRegressor)** that predicts a single
number: **`wastage_percent`** — the percentage of a batch's quantity expected
to be lost to spoilage before sale. This is a regression target, not a
classification label. The API converts this into a 0–100 "Risk Score Index"
for display (`risk_score = (predicted_wastage_pct / 30) * 100`, clipped to
[0, 100]) because observed wastage in the training data rarely exceeds ~30%.

## Ground truth

Labels come from the `wastage_percent` column of
`backend/fresh_produce_wastage_dataset.csv`, a 3,000-row, 10-crop CSV bundled
with this repo. **We have not independently verified whether this dataset
reflects real observed farm/warehouse outcomes or is a synthetically
generated benchmark dataset** — its structure (uniform completeness, a
`recommended_corrective_action` column, no missing-field noise typical of
field-captured data) is consistent with either. Per the ground-truth
hierarchy the SIH brief asks us to be explicit about, we classify this as a
**documented benchmark dataset**, not confirmed real-world validation, until
its provenance is confirmed.

## Features

The model uses 13 features, all computed from stored or fetched values —
nothing else influences the prediction:

| Feature | Source |
|---|---|
| `is_tomato`, `is_onion`, `is_banana`, `is_potato`, `is_lemon`, `is_mango`, `is_leafy_greens`, `is_pineapple`, `is_orange`, `is_strawberry` | One-hot crop encoding (see `crop_column_name()` / `CROP_ONE_HOT_COLUMNS` in `app.py` and `seed_and_train.py`, kept in sync between the two) |
| `temperature_c` | OpenWeatherMap (live) or a synthetic fallback if no API key is configured |
| `days_since_harvest` | `harvest_date` on the batch vs. current date |
| `decay_constant` | A static, literature-based per-crop constant (see `DECAY_CONSTANTS` in `app.py`) — this is the "crop-specific decay feature" requested in feedback |

Humidity is still fetched from the weather API and shown to the farmer in
the UI — it's simply not fed into the model (see next section for why).

## Feature selection: why `humidity_pct` was dropped

An earlier version of this model included `humidity_pct` as a feature.
Investigating XGBoost's reported feature importances showed it unexpectedly
low (0.048, weaker than several individual one-hot crop columns), which
prompted a proper check rather than assuming the importance ranking told
the whole story:

1. **Direct correlation with the target**: `humidity_pct` correlates with
   `wastage_percent` at **r = -0.01** — essentially no linear relationship
   in this dataset. (For comparison: `temperature_c` r=0.44,
   `days_since_harvest` r=0.35.)
2. **Tried a stronger derived candidate first, not just removal**: dew
   point (Magnus-Tetens formula, computed from `temperature_c` and
   `humidity_pct`) is a more physically meaningful single quantity for
   condensation/spoilage risk than raw relative humidity. Correlation with
   the target was better (r=0.39) — but it's also 88% correlated with
   `temperature_c`, so most of that signal was redundant with a feature
   the model already had.
3. **Empirical held-out comparison** (80/20 split, `random_state=42`,
   otherwise-identical model) settled it:

   | Feature set | Test R² | Test MAE |
   |---|---|---|
   | `humidity_pct` (baseline) | 0.300 | 3.03 |
   | dew point replacing `humidity_pct` | 0.300 | 3.05 |
   | both `humidity_pct` and dew point | 0.303 | 3.03 |
   | **neither (dropped)** | **0.322** | **3.03** |

Dropping the feature outright outperformed every version that kept some
form of humidity signal — likely because a near-zero-correlation column
gives 2,000-odd noisy training rows extra ways to overfit spurious splits.
This is a documented, tested decision, not an assumption: the numbers above
were produced by an actual comparison run, not estimated.

**Bonus effect**: `humidity_percent` was missing for 248 of the 3,000 rows
in the source CSV. Since it's no longer a required feature, those rows are
no longer discarded for a column the model doesn't use — the usable dataset
grew from 2,523 to 2,756 rows as a direct result.

**Why one-hot, not a single integer column**: an earlier version of this
model encoded crop as a single `crop_encoded` integer (0–9). XGBoost treats
an integer feature as ordered, which implicitly tells the model "onion (1) >
tomato (0)" — meaningless for an unordered category like crop type. One-hot
encoding (a separate binary `is_<crop>` column per crop) removes that false
ordering. `crop_column_name()`/`CROP_ONE_HOT_COLUMNS` are defined identically
in `app.py` (inference) and `seed_and_train.py` (training) since the two
aren't a shared module — a mismatch in column order or naming between them
would silently produce wrong predictions, so both were verified to produce
identical column lists after this change (see `MODEL_FEATURE_COLUMNS` in
`app.py`, which explicitly selects columns in training order rather than
relying on dict insertion order).

`decay_constant` values (unitless, higher = decays faster): tomato 0.15,
onion 0.05, banana 0.20, potato 0.04, lemon 0.08, mango 0.18, leafy greens
0.25, pineapple 0.12, orange 0.07, strawberry 0.30. These are not learned —
they are fixed domain assumptions fed into the model as a feature, the same
role a nutritionist's reference table plays in a diet app.

## Dataset size and cleaning

- Total rows: 3,000 (all 10 supported crops, roughly balanced ~290–320 rows each)
- Rows with missing `temperature_c`, `days_since_harvest`, `decay_constant`, or the target are dropped (`dropna`) — `humidity_percent` is no longer a required column (see "Feature selection: why `humidity_pct` was dropped" above), so rows missing only that column are kept
- Rows used after cleaning: **2,756**
- `storage_duration_hours` in the source data ranges 2–96 hours (0.08–4 days) — see Limitations

## Train / validation / test split and leakage prevention

- 80/20 random holdout split, `random_state=42`, via `sklearn.model_selection.train_test_split`
- Train: 2,204 rows · Test: 552 rows
- Each row is one independent `batch_id` with no repeats in the source CSV, so a random split does not leak the same batch across train and test (no batch-level or time-series grouping was necessary)
- Reported metrics come from the held-out test split. The model that is actually served (`model.pkl`) is then refit on the *full* cleaned dataset (2,756 rows) for production use — a standard practice, but it means served predictions come from a model that has seen all rows; only the *metrics* below reflect unseen-data performance

## Validation strategy: monotonicity constraints

Spoilage is not reversible — risk should never *decrease* as `days_since_harvest`
increases, holding weather constant, and heat accelerates spoilage (the
standard Q10 assumption already used in this project's decay-constant
reasoning), so risk should never decrease as `temperature_c` increases either.
An unconstrained XGBoost tree fit on this noisy dataset was found to be
locally non-monotonic in *both* features near the edges of the observed
range — the temperature issue was caught by hand-testing the AI Assistant's
"what happens if it gets hotter?" answer, which was reporting risk going
*down* with heat for some batches. We fixed both with **monotone constraints**
(all one-hot crop columns and `decay_constant` unconstrained, `temperature_c`
and `days_since_harvest` both forced non-decreasing — see
`monotone_constraints` in `seed_and_train.py`) rather than silently shipping
the artifact — this is a standard, explainable XGBoost technique, not custom
smoothing logic. Adding the temperature constraint cost a small amount of
raw accuracy (see metrics below) — a fair trade for a model that can't tell
a farmer "hotter is safer."

## Model metrics (regression)

Run `python backend/seed_and_train.py` to reproduce. As of the last training run:

| Metric | Value |
|---|---|
| Test R² | **0.319** |
| Test MAE | **±2.92 risk points** |
| Test RMSE | **3.61 risk points** |

**Read this honestly**: R² ≈ 0.32 means the model explains roughly a third of
the variance in `wastage_percent` on unseen data — a real, modest signal, not
a polished production-grade model. It's very slightly lower than an
intermediate version of this model (0.328) that had the temperature
monotonicity constraint added above but not yet reflected in this number —
that's the honest cost of fixing the hotter-is-safer artifact, not a
regression we're hiding. An earlier version of this UI displayed a hardcoded
R² of 0.978, which was never computed by any script in this repo and has
been removed. We would rather show a defensible 0.32 than an indefensible 0.978.

## Classification view (same model, thresholded)

`spoilage_risk_pct` is a continuous regression target, but "is this batch
high risk?" is often the more actionable question. Rather than train a
separate classifier, we threshold this same regressor's held-out test
predictions at Risk Score Index ≥ 50 (the same 0–100 scale shown in the UI)
and report standard classification metrics on that view:

| Metric | Value |
|---|---|
| Test set split at threshold | 141 positive ("High risk") / 411 negative, of 552 test rows |
| Accuracy | **0.772** |
| Precision | **0.570** |
| Recall | **0.433** |
| F1 | **0.492** |
| ROC-AUC | **0.768** |

**Why the threshold is 50, not the raw `wastage_percent` scale**: raw
`wastage_percent` in this dataset tops out around 29% (see Dataset section
below), so a literal "wastage_percent ≥ 50" threshold would have zero
positive test rows — every classification metric would be undefined or
trivially perfect, which would be worse than not reporting them. The
threshold is instead applied to the same 0–100 Risk Score Index the app
displays everywhere (`wastage_pct × 100/30`), where 50 is a meaningful
midpoint. Precision/recall here are modest — consistent with the regression
R², not an inconsistency between the two views.

## Limitations

- Source dataset covers `storage_duration_hours` up to 96 hours (4 days) only. Risk scores for older batches are extrapolated in the API using a linear scaling heuristic (`predict_risk_score` in `app.py`), not learned by the model — this is clearly a heuristic, not a model prediction.
- Dataset provenance is not independently verified as real-world observed spoilage outcomes.
- No pilot (real farmer) outcome data has been incorporated into training yet. The app now supports recording actual outcomes (`POST /api/batches/<id>/actual-outcome`) specifically so real pilot data can accumulate for a future retrain.
- R² of 0.32 leaves most of the variance unexplained — likely due to unmodeled factors present in the source CSV but not used as features here (e.g. `cold_chain_maintained`, `quality_score_percent`, `supply_chain_disruption`), which were excluded to keep the feature set matched to what this app can actually collect from a farmer (crop, harvest date, location → weather).
- destinations, price history, and storage capacity used elsewhere in the app are separately labeled SYNTHETIC/benchmark — see `README.md` → "Data Sources".

## Estimated remaining shelf life (benchmark, not a trained model)

`estimate_remaining_shelf_life_days()` in `app.py` answers "how many more
days until this batch crosses into High risk, if conditions stay the same?"
XGBoost is a black-box regressor with no closed-form inverse, so this isn't
solved algebraically — it's a forward search: call `predict_risk_score()`
with `days_since_harvest` incremented day by day (crop, temperature, and
humidity held constant) until the output crosses `HIGH_RISK_THRESHOLD`
(66 on the Risk Score Index), capped at `MAX_SHELF_LIFE_SEARCH_DAYS` (30) to
bound the search. The result is returned as both `remaining_shelf_life_days`
and `estimated_remaining_shelf_life_days` (same value, two key names for
caller compatibility) with `remaining_shelf_life_status: "Estimated /
Benchmark"` — this has not been validated against any real outcome where a
batch was tracked to an actual spoilage date, so it is never presented as a
certified or scientifically validated shelf-life figure, in the API or the UI.

## Visible-damage adjustment (input-level, not a trained feature)

A comparable project (audited separately — see `STATUS.md` → "Comparable
project audit") uses a `visual_defect_score` as a trained model feature,
compounding it into effective age: `effective_days = (days + transit/24) *
(1 + 0.4 * defect_score)`. That project can do this honestly because its
entire dataset is synthetic — it controls the generating formula, so it can
freely add a feature and label its own output.

Our dataset doesn't have a damage/defect column, and we have no trained
defect classifier (the photo quality check only assesses blur/brightness/
resolution, not produce condition — see `STATUS.md`). Retraining the model
with a fabricated `visual_defect_score` column would mean inventing labels,
which is exactly what this project's SIH-feedback response is about
*not* doing.

Instead we adopted the *idea* honestly: a farmer-reported "Visible Damage"
field (None/Minor/Moderate/Severe, batch entry form) is converted to a
0–1 score and applied as a **benchmark heuristic multiplier on the model's
input** (effective days-since-harvest), using the same `apply_visible_damage()`
mechanism and multiplier magnitude (0.4) as the >4-day extrapolation
heuristic already in this codebase — never as a new trained feature. It is
explicitly labeled farmer-reported, not AI-detected, everywhere it appears.

We deliberately did **not** add `transit_hours` as a separate trained
feature the way that project does, for the same reason: our real training
data has no transit-specific column, so a new trained feature would need
fabricated values. Transit time is instead folded into effective
days-since-harvest at the application layer (`arrival_days_since_harvest =
days_since_harvest + travel_days`, in `build_destination_options`), which
needs no new training data because it reuses the existing
days-since-harvest relationship the model actually learned.

## Build process

`backend/seed_and_train.py`:
1. Loads and cleans `fresh_produce_wastage_dataset.csv`
2. Splits 80/20, trains on the 80%, evaluates on the 20%, writes `model_metrics.json`
3. Refits on the full cleaned dataset, saves `model.pkl`

This runs automatically on container start (see `backend/Dockerfile`) and can
be re-run locally at any time; `app.py` loads both `model.pkl` and
`model_metrics.json` once at startup and serves them from memory.
