# Q&A Preparation — SIH Round 2

Every answer here is grounded in the actual implementation as of this
document's writing. If the code changes, re-verify these before presenting
them — a stale Q&A answer is worse than no answer.

**1. What exactly does XGBoost predict?**
A single regression output: `wastage_percent` — the percentage of a batch's
quantity expected to be lost to spoilage. It is converted to a 0–100 "Risk
Score Index" for display (`(predicted_pct / 30) * 100`, clipped), because
observed wastage in the training data rarely exceeds ~30%.

**2. Why did you choose XGBoost?**
Gradient-boosted trees handle the mixed, non-linear relationships between
temperature, humidity, days-since-harvest and decay constants well on a
small (~2,500-row) tabular dataset, without needing the volume a neural
network would require. It also supports monotonicity constraints natively,
which we use to enforce that risk never decreases as a batch ages.

**3. What is your target variable?**
`wastage_percent`, sourced directly from the training CSV's `wastage_percent`
column — see `MODEL.md`.

**4. What is your training dataset?**
`backend/fresh_produce_wastage_dataset.csv` — 3,000 rows, 10 crops, cleaned
to 2,756 rows after dropping missing values (only for columns the model
actually uses — see Q9a on why that count is higher than an earlier
version). We have **not** independently verified whether it reflects real
observed outcomes or is a synthetically generated benchmark; we say so
explicitly rather than claiming it's real.

**5. What is your ground truth?**
The `wastage_percent` label in that same dataset. There is no separate
"ground truth" beyond the dataset's own recorded value — we do not have
independent lab-verified spoilage measurements.

**6. How did you split the data?**
80/20 random holdout, `random_state=42`, via `sklearn.train_test_split`.
2,204 training rows, 552 test rows. Metrics reported are computed only on
the held-out 20%.

**7. How did you prevent data leakage?**
Each row is one independent `batch_id` with no repeats in the source data,
so a random split doesn't put the same batch in both train and test. No
batch-level or time-series grouping was necessary because there's no
repeated-entity structure to leak across. (If we later ingest real pilot
data with repeated farms/batches over time, we'd move to a grouped or
time-aware split — flagged as a Round 2.2 task.)

**8. What are your model metrics?**
Test R² = 0.319, Test MAE = ±2.92 risk points, Test RMSE = 3.61 risk points.
We also report a thresholded classification view on the same held-out
predictions (Risk Score Index ≥50 = "High risk"): Accuracy 0.772, Precision
0.570, Recall 0.433, F1 0.492, ROC-AUC 0.768 — modest, consistent with the
regression R², not a separately trained/cherry-picked classifier. We show
these honest numbers rather than a fabricated one — an earlier version of
this UI hardcoded R²=0.978, which was never computed by any script in the
repo, and we removed it.

**8a. Why did your metrics improve between versions of this document?**
We tested `humidity_pct` as a feature and found it correlated with the
target at r=-0.01 (essentially noise), and that a model trained *without*
it outperformed one with it on held-out data (R²=0.32 vs 0.30) — we also
tried a derived dew-point feature as a smarter replacement, which didn't
help either (88% correlated with temperature, so no new signal). We
dropped it. That also let 248 previously-excluded rows (missing only
`humidity_percent`) back into training. The metrics above reflect that
change — we retrain and re-measure rather than letting documentation drift
from what the code actually does.

**8b. Does your model always predict higher risk for hotter conditions?**
Yes, by construction — a monotone constraint forces predicted risk to never
decrease as temperature rises, holding other inputs constant (the same
technique already used for days-since-harvest, both in `seed_and_train.py`).
This wasn't theoretical: it was caught by testing the AI Assistant's "what
if it gets hotter?" answer, which was reporting risk going *down* with heat
for some batches before the fix. Cost a small amount of raw accuracy
(R² 0.328→0.319) — a fair trade for not telling a farmer that heat is safer.

**9. What are your crop-specific features?**
One-hot crop encoding — a separate `is_tomato`, `is_onion`, ... binary
column per crop (10 total), not a single ordinal integer (which would
falsely imply crops have a numeric order) — and `decay_constant` (a
literature-based, per-crop constant — e.g., strawberry 0.30 vs. potato
0.04), combined with `temperature_c` and `days_since_harvest`. Full table
in `MODEL.md`.

**9a. Your classification threshold is "Risk Index ≥50" — why not threshold the raw wastage_percent target directly?**
Because raw `wastage_percent` in this dataset tops out around 29% — a
literal `wastage_percent ≥50` threshold would have zero positive rows in
the entire test set, making precision/recall/F1 undefined and ROC-AUC
meaningless. We instead threshold the same held-out predictions on the
0–100 Risk Score Index the UI actually shows (`wastage_pct × 100/30`),
where 50 is a real, non-degenerate midpoint (141 positive / 411 negative
in our 552-row test set). This is documented in `MODEL.md` specifically so
it doesn't look like an arbitrary choice.

**10. How does spoilage risk affect destination selection?**
Risk at arrival (recomputed for each destination's specific travel time) is
multiplied by the batch's expected revenue to get an expected spoilage loss,
which is subtracted in the expected-value formula — see Q13.

**11. Why not choose the nearest market?**
Nearest minimizes travel time and arrival risk but ignores price — it can
leave money on the table. We show it as one of four baselines precisely so
this trade-off is visible, not asserted.

**12. Why not choose the highest-price market?**
Highest price ignores distance, transport cost, and the extra spoilage risk
of a longer transit — it can look good on price and lose more to spoilage
and transport than it gains. Also shown as a baseline for comparison.

**13. What is your destination optimization formula?**
`expected_realised_value = revenue − transport_cost − storage_cost − expected_spoilage_loss`,
where `expected_spoilage_loss = spoilage_probability × value_at_risk` and
`value_at_risk` is simplified to the batch's full expected revenue (i.e.,
the value that would be lost if the whole batch spoiled). This is a
documented simplifying assumption, not a fitted quantity — see
`compute_expected_value()` in `app.py`.

**14. What baselines did you compare against?**
Nearest Market, Highest Price Market, Price-Minus-Distance, and AgriRoute AI
(best expected value) — all computed from the same underlying data so the
comparison is apples-to-apples. See `/api/batches/<id>/baseline-comparison`.

**15. What is real data?**
Batches, risk assessments, route selections, and actual outcomes created by
using the app are real database rows. Weather is real when an OpenWeatherMap
key is configured.

**16. What is synthetic data?**
Market prices, destination locations/capacities, and (when no weather key is
set) weather readings. All are explicitly labeled SYNTHETIC or BENCHMARK in
both the API and UI — never shown as "live."

**17. How do you handle stale market prices?**
We don't currently distinguish "stale" from "current" within the synthetic
price history — since it's demo data, not a live feed, "staleness" isn't
yet a meaningful concept. Once a real price feed is connected (Round 2.2
scope), we'd add a timestamp-based staleness check and surface it in the UI
rather than silently using an old number.

**18. Can the image analyzer certify quality?**
There is no image analyzer implemented yet. If/when built, it would be
labeled "AI Visual Quality Assessment," never "Official Quality
Certificate" — the plan explicitly avoids that framing.

**19. Can GPT guarantee a price?**
There is no GPT/LLM integration. The rule-based farmer assistant, when given
a batch context, answers using that batch's real computed price/risk/route
values and explicitly appends "Actual selling price may vary" — it never
promises a specific price.

**20. What happens if the crop image is blurry?**
Not applicable yet — no image pipeline exists. The intended behavior (not
yet built) is documented in the project brief: classify photo quality as
GOOD/FAIR/POOR and refuse a confident result on POOR, with retake
instructions.

**21. What happens if the weather API fails?**
`fetch_weather_data()` catches the request exception and falls back to a
fixed synthetic reading, flagged `is_synthetic: true`, which the UI then
displays with a "Synthetic weather data" notice rather than silently
pretending it's live.

**22. What happens if market data is unavailable?**
Destinations without a price history row fall back to the destination's
`base_price_per_kg`; if that's also null (e.g., a storage facility), we use
the average mandi reference price for that crop as a labeled BENCHMARK,
rather than showing ₹0 or a nonsensical negative value (a bug we found and
fixed during this review — storage facilities previously showed negative
"expected money" because ₹0 was being treated as a real price).

**23. What is actually implemented?**
See `STATUS.md` Section 1 for the full audit — spoilage risk, shelf life,
destination ranking with baselines and route modes, sell-vs-store, batch
passport, and predicted-vs-actual are implemented. Image analysis, GPT, and
real SMS/IVR are not.

**24. What remains for Round 2.2?**
See `ROADMAP.md`.

**25. What is your main innovation?**
Integrating spoilage-risk prediction with destination and route optimization
in one post-harvest decision workflow, with the optimization shown
transparently (a "Why this market?" breakdown, four comparable baselines,
and honest data-source labeling) rather than as an opaque score.
