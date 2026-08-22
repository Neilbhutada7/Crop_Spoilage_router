"""
Per-batch, plain-language explanation of a risk score -- "why did THIS
batch get THIS number", not just the general methodology.

Ranks temperature, humidity, and days-since-harvest by a counterfactual:
how many risk points would this score drop by if THIS ONE factor were
swapped for a low-risk baseline (optimal temperature / optimal humidity /
routed within a day), holding the other two inputs at their actual
values? All three deltas come out in the same unit (risk-score points),
so they're directly comparable and rankable -- unlike comparing a
temperature multiplier to a fraction of shelf life.

This is computed from the same deterministic decay formula that
generates the model's training labels (decay_constants.spoilage_risk_pct),
not a literal decomposition of the trained XGBoost model's internal
weights (that would need SHAP/feature-attribution tooling) -- it's
labeled as such in the summary so it isn't mistaken for one.
"""
import os
import sys

_ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from decay_constants import DECAY_CONSTANTS, spoilage_risk_pct  # noqa: E402

FRESH_BASELINE_DAYS = 1  # "if this had been routed almost immediately"


def _contribution(crop_type, temperature_c, humidity_pct, days_since_harvest, actual_score, vary):
    cfg = DECAY_CONSTANTS[crop_type]
    temp = cfg["optimal_temp_c"] if vary == "temperature" else temperature_c
    hum = cfg["optimal_humidity_pct"] if vary == "humidity" else humidity_pct
    days = FRESH_BASELINE_DAYS if vary == "days" else days_since_harvest
    baseline_score = spoilage_risk_pct(crop_type, temp, hum, days)
    return round(actual_score - baseline_score, 1)


def _effect_phrase(points: float) -> str:
    magnitude = abs(points)
    if magnitude < 3:
        return "barely affecting"
    if magnitude < 12:
        return "a moderate contributor to" if points > 0 else "a modest help to"
    return "a major driver of" if points > 0 else "significantly helping"


def _temperature_reason(crop_type, temperature_c, contribution):
    cfg = DECAY_CONSTANTS[crop_type]
    optimal = cfg["optimal_temp_c"]
    delta = round(temperature_c - optimal, 1)
    if abs(delta) < 0.5:
        text = (
            f"Temperature ({temperature_c}°C) is right at {crop_type}'s ideal storage "
            f"temperature ({optimal}°C) — barely affecting the score."
        )
    else:
        direction = "above" if delta > 0 else "below"
        sign = "+" if contribution >= 0 else "-"
        text = (
            f"Temperature ({temperature_c}°C) is {abs(delta)}°C {direction} {crop_type}'s ideal "
            f"{optimal}°C — {_effect_phrase(contribution)} the score "
            f"({sign}{abs(contribution)} pts vs. ideal temperature)."
        )
    return {"factor": "temperature", "text": text, "contribution": contribution}


def _humidity_reason(crop_type, humidity_pct, contribution):
    cfg = DECAY_CONSTANTS[crop_type]
    optimal = cfg["optimal_humidity_pct"]
    delta = round(humidity_pct - optimal, 1)
    if abs(delta) < 1:
        text = (
            f"Humidity ({humidity_pct}%) is right at {crop_type}'s ideal {optimal}% — "
            f"barely affecting the score."
        )
    else:
        direction = "above" if delta > 0 else "below"
        sign = "+" if contribution >= 0 else "-"
        text = (
            f"Humidity ({humidity_pct}%) is {abs(delta)} points {direction} {crop_type}'s ideal "
            f"{optimal}% — {_effect_phrase(contribution)} the score "
            f"({sign}{abs(contribution)} pts vs. ideal humidity)."
        )
    return {"factor": "humidity", "text": text, "contribution": contribution}


def _days_reason(crop_type, days_since_harvest, contribution):
    cfg = DECAY_CONSTANTS[crop_type]
    shelf_life = cfg["reference_shelf_life_days"]
    if days_since_harvest <= FRESH_BASELINE_DAYS:
        text = (
            f"It's very fresh — only {days_since_harvest} day(s) since harvest, well within "
            f"{crop_type}'s typical {shelf_life}-day shelf life — barely affecting the score."
        )
    else:
        sign = "+" if contribution >= 0 else "-"
        text = (
            f"It's {days_since_harvest} days since harvest, {round(100 * days_since_harvest / shelf_life)}% "
            f"of {crop_type}'s typical {shelf_life}-day shelf life — {_effect_phrase(contribution)} the "
            f"score ({sign}{abs(contribution)} pts vs. routing within a day of harvest)."
        )
    return {"factor": "days_since_harvest", "text": text, "contribution": contribution}


def explain(crop_type: str, temperature_c: float, humidity_pct: float,
            days_since_harvest: float, risk_score: float, risk_label: str) -> dict:
    # Contributions are computed against the deterministic formula's own score for
    # these exact inputs -- NOT the displayed ML risk_score -- so that a factor
    # already at its baseline value nets to exactly 0 rather than picking up the
    # (unrelated) gap between the formula and the trained model's prediction.
    formula_score = spoilage_risk_pct(crop_type, temperature_c, humidity_pct, days_since_harvest)
    common = (crop_type, temperature_c, humidity_pct, days_since_harvest, formula_score)
    temp_c = _contribution(*common, vary="temperature")
    hum_c = _contribution(*common, vary="humidity")
    days_c = _contribution(*common, vary="days")

    reasons = [
        _days_reason(crop_type, days_since_harvest, days_c),
        _temperature_reason(crop_type, temperature_c, temp_c),
        _humidity_reason(crop_type, humidity_pct, hum_c),
    ]
    reasons.sort(key=lambda r: abs(r["contribution"]), reverse=True)

    top = reasons[0]
    top_phrase = {
        "days_since_harvest": "time since harvest",
        "temperature": "temperature",
        "humidity": "humidity",
    }[top["factor"]]

    summary = f"{risk_label} risk ({round(risk_score)}/100) — {top_phrase} is the biggest factor right now."
    note = (
        "Point values come from the same decay-rate formula used to generate the model's "
        "training data (not a literal breakdown of the trained XGBoost model's internal "
        "weights), so they may not sum to exactly the displayed score."
    )

    return {
        "summary": summary,
        "note": note,
        "reasons": [
            {"factor": r["factor"], "text": r["text"], "contribution": r["contribution"]}
            for r in reasons
        ],
    }
