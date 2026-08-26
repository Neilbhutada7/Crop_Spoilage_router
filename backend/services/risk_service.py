import datetime
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ML_DIR = os.path.join(_BACKEND_DIR, "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from decay_constants import HIGH_RISK_THRESHOLD_PCT  # noqa: E402
from predict import model_version, predict_risk, risk_label  # noqa: E402

from db import SessionLocal  # noqa: E402
from models import HarvestBatch, RiskAssessment  # noqa: E402
from services.explanation_service import explain  # noqa: E402
from services.weather_service import get_weather, get_weather_series  # noqa: E402

# How far ahead to look for the model's own risk score crossing the High
# threshold before giving up and reporting a capped lower-bound estimate.
MAX_SHELF_LIFE_HORIZON_DAYS = 45


class BatchNotFoundError(Exception):
    pass


def _model_projected_remaining_days(batch: HarvestBatch, current_score: float, days_since_harvest_now: float,
                                     temp_override: float | None = None, hum_override: float | None = None,
                                     visual_defect_score: float = 0.0) -> tuple[float, bool]:
    """Days from now until THIS SAME TRAINED MODEL's own risk score first
    reaches the High-risk threshold. With no overrides, steps forward day by
    day using real (or, past the forecast window, synthetic) weather for
    each future date -- see forecast_risk() below, which walks the same
    path for the risk-over-time chart. With temp_override/hum_override set
    (the what_if_risk() case), those conditions are held constant forward
    instead, matching "if it stayed this hot, how many more days" rather
    than switching back to the real forecast partway through.

    Replaces an earlier version that inverted a separate closed-form decay
    formula instead of the trained model: that produced numbers that could
    flatly contradict today's own risk score (e.g. "65% risk today"
    alongside "safe for 30 more days"), since the two methods don't always
    agree. Using the model itself guarantees the two numbers on screen can
    never contradict each other -- if today's score is already at or above
    the threshold, remaining days is 0, not a number pulled from an
    unrelated formula. Returns (days, was_capped); was_capped=True means the
    model never reached the threshold within MAX_SHELF_LIFE_HORIZON_DAYS and
    the returned value is a lower bound, not an exact crossing day."""
    if current_score >= HIGH_RISK_THRESHOLD_PCT:
        return 0.0, False

    lat, lon = float(batch.farm_latitude), float(batch.farm_longitude)
    today = datetime.date.today()

    # One batched weather request covering the whole horizon instead of up
    # to 45 separate per-day Open-Meteo calls (~14s -> a few hundred ms) --
    # see weather_service.get_weather_series. Only fetched when needed
    # (temp/hum overrides skip weather entirely).
    weather_by_date = None
    if temp_override is None or hum_override is None:
        weather_by_date = get_weather_series(lat, lon, today + datetime.timedelta(days=1), MAX_SHELF_LIFE_HORIZON_DAYS)

    for offset in range(1, MAX_SHELF_LIFE_HORIZON_DAYS + 1):
        days_since_harvest = days_since_harvest_now + offset
        if temp_override is not None and hum_override is not None:
            temp, hum = temp_override, hum_override
        else:
            target_date = today + datetime.timedelta(days=offset)
            weather = weather_by_date[target_date.isoformat()]
            temp, hum = weather["temperature_c"], weather["humidity_pct"]
        score = predict_risk(
            crop_type=batch.crop_type,
            temperature_c=temp,
            humidity_pct=hum,
            days_since_harvest=days_since_harvest,
            visual_defect_score=visual_defect_score,
        )
        if score >= HIGH_RISK_THRESHOLD_PCT:
            return float(offset), False
    return float(MAX_SHELF_LIFE_HORIZON_DAYS), True


def assess_risk(batch_id: int) -> dict:
    session = SessionLocal()
    try:
        batch = session.get(HarvestBatch, batch_id)
        if batch is None:
            raise BatchNotFoundError(f"harvest_batches.id={batch_id} not found")

        today = datetime.date.today()
        days_since_harvest = max((today - batch.harvest_date).days, 0)

        # Deliberately NOT get_weather()'s instant "current conditions" --
        # that reads whatever the weather is at the exact second the
        # farmer opens the app (could be a cool, humid 1am reading), while
        # the shelf-life projection below walks every future day using the
        # closest-to-midday reading (a stable, representative point in each
        # day). Comparing an instant "now" reading against midday-based
        # future days created an artificial risk jump on the very first
        # projected day whenever "now" wasn't already midday -- e.g. a
        # potato showing 46% at 1:30am, then apparently jumping past the
        # High-risk threshold "tomorrow" once the projection switched to a
        # real midday reading barely different from today's own midday
        # temperature. Using the same midday-based reading for today's own
        # score keeps the whole walk on one consistent basis, so today's
        # score and "days remaining" can never contradict each other for
        # this reason. See get_weather_series in weather_service.py.
        weather = get_weather_series(float(batch.farm_latitude), float(batch.farm_longitude), today, 1)[today.isoformat()]

        score = predict_risk(
            crop_type=batch.crop_type,
            temperature_c=weather["temperature_c"],
            humidity_pct=weather["humidity_pct"],
            days_since_harvest=days_since_harvest,
        )
        label = risk_label(score)

        assessment = RiskAssessment(
            batch_id=batch.id,
            risk_score=round(score, 1),
            risk_label=label,
            temperature_c=weather["temperature_c"],
            humidity_pct=weather["humidity_pct"],
            days_since_harvest=days_since_harvest,
            model_version=model_version(),
        )
        session.add(assessment)
        session.commit()

        explanation = explain(
            crop_type=batch.crop_type,
            temperature_c=weather["temperature_c"],
            humidity_pct=weather["humidity_pct"],
            days_since_harvest=days_since_harvest,
            risk_score=score,
            risk_label=label,
        )

        # Projected forward using this same trained model (see
        # _model_projected_remaining_days above) -- guaranteed consistent
        # with today's own risk_score, never a contradicting number from an
        # unrelated formula.
        remaining_days, capped = _model_projected_remaining_days(batch, score, days_since_harvest)

        # 7-day forecast for the new transparency section
        forecast_7_days = []
        forecast_weather = get_weather_series(float(batch.farm_latitude), float(batch.farm_longitude), today + datetime.timedelta(days=1), 7)
        for offset in range(1, 8):
            target_date = today + datetime.timedelta(days=offset)
            w = forecast_weather[target_date.isoformat()]
            f_score = predict_risk(
                crop_type=batch.crop_type,
                temperature_c=w["temperature_c"],
                humidity_pct=w["humidity_pct"],
                days_since_harvest=days_since_harvest + offset,
            )
            forecast_7_days.append({
                "date": target_date.isoformat(),
                "days_offset": offset,
                "risk_score": round(f_score, 1),
                "risk_label": risk_label(f_score),
                "temperature_c": w["temperature_c"],
                "humidity_pct": w["humidity_pct"]
            })

        return {
            "batch_id": batch.id,
            "risk_score": float(assessment.risk_score),
            "risk_label": assessment.risk_label,
            "temperature_c": float(assessment.temperature_c),
            "humidity_pct": float(assessment.humidity_pct),
            "days_since_harvest": assessment.days_since_harvest,
            "model_version": assessment.model_version,
            "weather_source": weather["source"],
            "weather_is_synthetic": weather["is_synthetic"],
            "weather_note": weather["note"],
            "created_at": assessment.created_at.isoformat() if assessment.created_at else None,
            "explanation": explanation,
            "shelf_life_estimate_capped": capped,
            "estimated_remaining_shelf_life_days": round(remaining_days, 1),
            "estimated_remaining_shelf_life_hours": round(remaining_days * 24, 1),
            "shelf_life_estimate_type": "MODEL_PROJECTION",
            "forecast_7_days": forecast_7_days,
        }
    finally:
        session.close()


def what_if_risk(batch_id: int, temperature_c: float | None = None,
                  humidity_pct: float | None = None, days_offset: int = 0,
                  visual_defect_score: float | None = None) -> dict:
    """Real recomputation of this batch's risk under a hypothetical condition
    (different temperature/humidity, `days_offset` more days since harvest,
    or a photo-derived visual_defect_score), using the same trained model as
    assess_risk -- not a guess. Not persisted to risk_assessments (that
    table holds actual assessments, not what-ifs). Used by the AI
    Assistant's what_if tool (gpt_tools.py) and by the photo analyzer
    (photo_analysis_service.py) to fold a real visual-condition reading into
    a genuine model call rather than inventing an adjusted risk number."""
    session = SessionLocal()
    try:
        batch = session.get(HarvestBatch, batch_id)
        if batch is None:
            raise BatchNotFoundError(f"harvest_batches.id={batch_id} not found")

        today = datetime.date.today()
        days_since_harvest = max((today - batch.harvest_date).days, 0) + days_offset
        # Same midday-consistent lookup as assess_risk() -- only fetched
        # when actually needed as a default, to avoid an unnecessary
        # weather call on every what-if that already supplies both values.
        if temperature_c is None or humidity_pct is None:
            weather = get_weather_series(float(batch.farm_latitude), float(batch.farm_longitude), today, 1)[today.isoformat()]
            temp = temperature_c if temperature_c is not None else weather["temperature_c"]
            hum = humidity_pct if humidity_pct is not None else weather["humidity_pct"]
        else:
            temp = temperature_c
            hum = humidity_pct
        defect = visual_defect_score if visual_defect_score is not None else 0.0

        score = predict_risk(
            crop_type=batch.crop_type,
            temperature_c=temp,
            humidity_pct=hum,
            days_since_harvest=days_since_harvest,
            visual_defect_score=defect,
        )

        # Same model-projection approach as assess_risk() -- here the
        # what-if condition (temp/hum/defect) is held constant forward
        # instead of switching to the real forecast, matching "if it stayed
        # this hot" rather than reverting mid-projection.
        remaining_days, capped = _model_projected_remaining_days(
            batch, score, days_since_harvest, temp_override=temp, hum_override=hum, visual_defect_score=defect
        )

        return {
            "batch_id": batch.id,
            "risk_score": round(score, 1),
            "risk_label": risk_label(score),
            "temperature_c": temp,
            "humidity_pct": hum,
            "days_since_harvest": days_since_harvest,
            "shelf_life_estimate_capped": capped,
            "estimated_remaining_shelf_life_days": round(remaining_days, 1),
            "estimated_remaining_shelf_life_hours": round(remaining_days * 24, 1),
            "shelf_life_estimate_type": "MODEL_PROJECTION",
        }
    finally:
        session.close()


def forecast_risk(batch_id: int, horizon_days: int = 6) -> list:
    """Projects the spoilage-risk model forward day by day (today..today+horizon_days)
    using Open-Meteo's real forecast where available, so a farmer can see how many
    days remain before a batch crosses into a worse risk band -- not just today's
    single score. Purely a projection: these points are NOT written to
    risk_assessments (that table holds actual assessments, not what-ifs)."""
    session = SessionLocal()
    try:
        batch = session.get(HarvestBatch, batch_id)
        if batch is None:
            raise BatchNotFoundError(f"harvest_batches.id={batch_id} not found")

        today = datetime.date.today()
        lat, lon = float(batch.farm_latitude), float(batch.farm_longitude)
        version = model_version()

        weather_by_date = get_weather_series(lat, lon, today, horizon_days + 1)

        points = []
        for offset in range(horizon_days + 1):
            target_date = today + datetime.timedelta(days=offset)
            days_since_harvest = max((target_date - batch.harvest_date).days, 0)
            weather = weather_by_date[target_date.isoformat()]
            score = predict_risk(
                crop_type=batch.crop_type,
                temperature_c=weather["temperature_c"],
                humidity_pct=weather["humidity_pct"],
                days_since_harvest=days_since_harvest,
            )
            points.append({
                "date": target_date.isoformat(),
                "days_from_now": offset,
                "days_since_harvest": days_since_harvest,
                "risk_score": round(score, 1),
                "risk_label": risk_label(score),
                "temperature_c": weather["temperature_c"],
                "humidity_pct": weather["humidity_pct"],
                "weather_is_synthetic": weather["is_synthetic"],
                "model_version": version,
            })
        return points
    finally:
        session.close()
