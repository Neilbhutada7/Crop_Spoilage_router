"""Loads the trained model artifact once and exposes a predict() helper.
Raises a clear error at import time if the artifact is missing, so a
misconfigured deployment fails fast instead of silently falling back to
an untrained model.
"""
import json
import os

import joblib
import pandas as pd

from decay_constants import CROP_TYPES, decay_constant_per_day, spoilage_risk_pct

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "..", "model_artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "model.pkl")
META_PATH = os.path.join(ARTIFACT_DIR, "model_meta.json")

_model = None
_meta = None


class ModelNotTrainedError(RuntimeError):
    pass


def _load():
    global _model, _meta
    if _model is not None:
        return
    if not os.path.exists(MODEL_PATH) or not os.path.exists(META_PATH):
        raise ModelNotTrainedError(
            "Spoilage model artifact not found. Run seed_and_train.py "
            "before starting the API."
        )
    _model = joblib.load(MODEL_PATH)
    with open(META_PATH) as f:
        _meta = json.load(f)


def model_version() -> str:
    _load()
    return _meta.get("trained_at", "v1.0")


def model_metadata() -> dict:
    """Full training metadata written by train_model.py"""
    _load()
    return dict(_meta)


def feature_importances() -> list:
    """XGBoost's built-in gain-based feature importance, sorted descending --
    which inputs the trained model actually leans on most."""
    _load()
    importances = _model.feature_importances_
    pairs = list(zip(_meta["features"], (float(x) for x in importances)))
    return sorted(pairs, key=lambda p: p[1], reverse=True)


# The trained model's own feature-importance report shows temperature_c
# (41%) and days_since_harvest (22%) dominating the prediction, with each
# individual crop one-hot flag contributing only 2-5% and decay_constant
# just 6.7%. Checking the source dataset directly explains why: mean
# wastage_percent barely differs by crop (potato 11.5% vs strawberry 11.9%
# vs banana 12.7% -- a ~1-point spread across crops with wildly different
# real shelf lives). The dataset itself doesn't encode realistic
# crop-specific spoilage differences, so a pure ML prediction is nearly
# crop-invariant: a potato and a banana come out almost identical on day 1,
# which contradicts basic post-harvest physiology. FORMULA_WEIGHT blends in
# decay_constants.spoilage_risk_pct() -- the literature-grounded Q10/
# reference-shelf-life formula, which DOES have strong, documented
# per-crop differentiation (potato ref_shelf_life=60 days vs mango=10) --
# so crop identity actually moves the score. Equal weighting: neither
# source is independently authoritative on its own (the dataset lacks
# crop differentiation; the formula lacks empirical validation), so this
# averages two independent, honestly-labeled estimates rather than
# silently trusting either one alone. See MODEL.md.
ML_WEIGHT = 0.5
FORMULA_WEIGHT = 0.5


def predict_risk(crop_type: str, temperature_c: float, humidity_pct: float,
                  days_since_harvest: float,
                  visual_defect_score: float = 0.0) -> float:
    if crop_type.lower() not in CROP_TYPES:
        raise ValueError(f"Unknown crop_type: {crop_type}")
    _load()

    # The trained XGBoost model itself (seed_and_train.py, trained on
    # fresh_produce_wastage_dataset.csv) uses exactly these 13 features, in
    # this order -- humidity_pct is NOT one of them; see MODEL.md "why
    # humidity_pct was dropped". It's still a real input to predict_risk()
    # as a whole, though: the ML/FORMULA_WEIGHT blend below feeds it into
    # decay_constants.spoilage_risk_pct(), which does use it. There is no
    # transit_hours feature -- destination_service.py folds travel time
    # into days_since_harvest instead (a real feature the ML model was
    # trained on), rather than passing a transit_hours argument that model
    # would silently ignore.
    # is_tomato, is_onion, is_banana, is_potato, is_lemon, is_mango, is_leafy_greens, is_pineapple, is_orange, is_strawberry, temperature_c, days_since_harvest, decay_constant
    row = {
        "temperature_c": temperature_c,
        "days_since_harvest": days_since_harvest,
        "decay_constant": decay_constant_per_day(crop_type),
    }
    for c in CROP_TYPES:
        clean_c = c.replace(" ", "_")
        row[f"is_{clean_c}"] = 1 if crop_type.lower() == c.lower() else 0

    X = pd.DataFrame([row])[_meta["features"]]
    pred = float(_model.predict(X)[0])

    # Scale from wastage percent to 0-100 risk score index (friend's formula)
    ml_risk_score = (pred / 30) * 100

    # Literature-grounded, strongly crop-differentiated estimate -- see
    # ML_WEIGHT/FORMULA_WEIGHT comment above.
    formula_risk_score = spoilage_risk_pct(crop_type, temperature_c, humidity_pct, days_since_harvest)

    risk_score = ML_WEIGHT * ml_risk_score + FORMULA_WEIGHT * formula_risk_score

    # If the user has a visual defect, we heuristically add it to the risk score since the friend's model didn't learn it
    if visual_defect_score > 0:
        risk_score += (visual_defect_score * 50)  # scale a 0.0-1.0 defect up to 50 risk points

    return max(0.0, min(risk_score, 100.0))


def risk_label(risk_score: float) -> str:
    # risk_score here is the FINAL blended score from predict_risk() (ML +
    # formula, see ML_WEIGHT/FORMULA_WEIGHT above), not the raw ML
    # prediction alone. High cutoff (50) is inherited from
    # HIGH_RISK_INDEX_THRESHOLD in seed_and_train.py -- the threshold the
    # pure-ML model's own accuracy/precision/recall/F1/ROC-AUC in
    # model_metrics.json were computed against. Blending in the formula
    # component means those reported metrics describe the ML half of this
    # score, not the exact blended number risk_label() sees -- there is no
    # independent validation of the blended score itself, so 50 is kept as
    # the best available reference point rather than an equally-arbitrary
    # alternative. Low/Medium was never independently validated either (the
    # dataset's classification view is a binary High/not-High split), so 34
    # is kept as an unvalidated, roughly-even split of the "not High" range.
    if risk_score < 34:
        return "Low"
    if risk_score < 50:
        return "Medium"
    return "High"
