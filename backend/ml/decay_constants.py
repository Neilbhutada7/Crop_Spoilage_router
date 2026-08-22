"""
Crop-specific post-harvest decay constants. Covers all 10 crops the
deployed spoilage model was trained on (tomato, onion, banana, potato,
mango, lemon, leafy greens, pineapple, orange, strawberry) -- see
MODEL.md. The app currently only exposes the first 5 of these as
selectable crops (see CROPS in frontend/src/pages/BatchAnalysis.jsx);
chili was removed after it turned out to have no real data behind it at
all in either the model's training set or this file.

These are illustrative figures grounded in ICAR-CIPHET-style post-harvest
loss literature and general food-science storage guidance (e.g. Q10
temperature-sensitivity rule of thumb: spoilage rate roughly doubles for
every 10C a commodity is held above its optimal storage temperature).
They are NOT pulled from a live data feed and should be replaced with
crop-trial-calibrated constants before any production use -- see MODEL.md.

reference_shelf_life_days: days to reach ~50% cumulative spoilage risk
    when held at optimal_temp_c / optimal_humidity_pct.
optimal_temp_c / optimal_humidity_pct: recommended cold-chain storage
    conditions for the commodity.
humidity_sensitivity: how sharply deviation from optimal humidity
    (in either direction) accelerates spoilage for this crop.
"""
import math

DECAY_CONSTANTS = {
    "tomato": {
        "reference_shelf_life_days": 15,
        "optimal_temp_c": 13.0,
        "optimal_humidity_pct": 90.0,
        "humidity_sensitivity": 1.0,
    },
    "onion": {
        "reference_shelf_life_days": 60,
        "optimal_temp_c": 15.0,
        "optimal_humidity_pct": 65.0,
        "humidity_sensitivity": 1.5,
    },
    "banana": {
        "reference_shelf_life_days": 12,
        "optimal_temp_c": 14.0,
        "optimal_humidity_pct": 90.0,
        "humidity_sensitivity": 1.0,
    },
    "potato": {
        "reference_shelf_life_days": 60,
        "optimal_temp_c": 7.0,
        "optimal_humidity_pct": 85.0,
        "humidity_sensitivity": 1.1,
    },
    "mango": {
        "reference_shelf_life_days": 10,
        "optimal_temp_c": 13.0,
        "optimal_humidity_pct": 90.0,
        "humidity_sensitivity": 1.0,
    },
    "lemon": {
        "reference_shelf_life_days": 30,
        "optimal_temp_c": 10.0,
        "optimal_humidity_pct": 90.0,
        "humidity_sensitivity": 1.0,
    },
    "leafy greens": {
        "reference_shelf_life_days": 5,
        "optimal_temp_c": 2.0,
        "optimal_humidity_pct": 95.0,
        "humidity_sensitivity": 2.0,
    },
    "pineapple": {
        "reference_shelf_life_days": 14,
        "optimal_temp_c": 10.0,
        "optimal_humidity_pct": 90.0,
        "humidity_sensitivity": 1.0,
    },
    "orange": {
        "reference_shelf_life_days": 21,
        "optimal_temp_c": 5.0,
        "optimal_humidity_pct": 90.0,
        "humidity_sensitivity": 1.0,
    },
    "strawberry": {
        "reference_shelf_life_days": 5,
        "optimal_temp_c": 0.0,
        "optimal_humidity_pct": 90.0,
        "humidity_sensitivity": 1.5,
    },
}

CROP_TYPES = tuple(DECAY_CONSTANTS.keys())


def decay_constant_per_day(crop_type: str) -> float:
    """k such that risk = 1 - exp(-k * t) reaches 50% at the crop's
    reference shelf life under optimal storage conditions."""
    ref_days = DECAY_CONSTANTS[crop_type]["reference_shelf_life_days"]
    return math.log(2) / ref_days


def temperature_multiplier(crop_type: str, temperature_c: float) -> float:
    """Q10-style multiplier: spoilage rate doubles per 10C above optimal,
    and slows (floored) below optimal. Clipped to a plausible range."""
    optimal = DECAY_CONSTANTS[crop_type]["optimal_temp_c"]
    multiplier = 2.0 ** ((temperature_c - optimal) / 10.0)
    return max(0.25, min(multiplier, 6.0))


def humidity_multiplier(crop_type: str, humidity_pct: float) -> float:
    """Deviation from optimal humidity (either direction) accelerates
    spoilage; magnitude controlled by the crop's humidity_sensitivity."""
    cfg = DECAY_CONSTANTS[crop_type]
    optimal = cfg["optimal_humidity_pct"]
    sensitivity = cfg["humidity_sensitivity"]
    deviation = abs(humidity_pct - optimal) / 100.0
    multiplier = 1.0 + sensitivity * deviation
    return max(0.5, min(multiplier, 2.5))


def spoilage_risk_pct(crop_type: str, temperature_c: float, humidity_pct: float,
                       days_since_harvest: float) -> float:
    """Deterministic spoilage-risk formula (0-100) used both to generate
    synthetic training data and as a sanity check on model output.
    risk = f(temperature, humidity, days_since_harvest, decay_constant)
    """
    k = decay_constant_per_day(crop_type)
    k_eff = (
        k
        * temperature_multiplier(crop_type, temperature_c)
        * humidity_multiplier(crop_type, humidity_pct)
    )
    risk = 100.0 * (1.0 - math.exp(-k_eff * max(days_since_harvest, 0)))
    return max(0.0, min(risk, 100.0))


# Same risk_label boundary used everywhere else in the app (predict.py
# risk_label()): risk >= 50 is "High". 50 matches HIGH_RISK_INDEX_THRESHOLD
# in seed_and_train.py -- the threshold the deployed model's own
# accuracy/precision/recall/F1/ROC-AUC in model_metrics.json were actually
# computed against, so the app's live "High risk" decisions match what the
# reported validation metrics describe. Remaining shelf life is defined as
# the time from now until this same formula would cross that boundary if
# current conditions held -- a closed-form inversion of spoilage_risk_pct,
# not a separately trained/validated model. Always label this a
# BENCHMARK ESTIMATE in the UI, never a validated shelf-life prediction.
HIGH_RISK_THRESHOLD_PCT = 50.0


def remaining_shelf_life_days(crop_type: str, temperature_c: float, humidity_pct: float,
                               days_since_harvest: float,
                               threshold_risk_pct: float = HIGH_RISK_THRESHOLD_PCT) -> float:
    k = decay_constant_per_day(crop_type)
    k_eff = (
        k
        * temperature_multiplier(crop_type, temperature_c)
        * humidity_multiplier(crop_type, humidity_pct)
    )
    if k_eff <= 0:
        return 0.0
    total_days_at_threshold = -math.log(1.0 - threshold_risk_pct / 100.0) / k_eff
    return max(0.0, total_days_at_threshold - max(days_since_harvest, 0))
