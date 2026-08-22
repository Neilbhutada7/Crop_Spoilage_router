"""
AI Visual Quality Assessment -- orchestrates the honest photo-analysis
pipeline:

    photo -> quality check -> (retake if POOR) -> enhancement
    -> heuristic visual-consistency score/grade -> market reference price
    -> quality-adjusted asking-price range -> spoilage risk incl. visual
    condition (real XGBoost call) -> destination ranking incl. visual
    condition

Every stage that touches a *number* either reads real data (price history,
distance, weather) or is a documented classical-CV/statistical heuristic --
see vision/image_quality.py, vision/image_enhancement.py and
vision/visual_grade.py for exactly what each one measures and what it does
NOT claim to detect. No crop classifier, no per-defect detector, and no
multi-item counter exist in this project, so this module does not attempt
crop auto-identification, named defects (rot/crack/bruise), or per-item
counts -- the frontend asks the farmer to pick the crop instead.
"""
import base64
import datetime
import io

from PIL import Image, ImageOps

from db import SessionLocal
from models import Destination, PriceHistory
from services.batch_service import VALID_CROP_TYPES
from services.destination_service import rank_destinations
from services.risk_service import BatchNotFoundError, what_if_risk
from vision import image_enhancement, image_quality, visual_grade

MAX_IMAGE_DIMENSION = 1600  # cap decode size -- a phone photo doesn't need to be analysed at full 12MP

# Illustrative, documented benchmark adjustment -- NOT derived from verified
# historical transaction data (none exists in this project). See spec
# section 14's explicit fallback: show the reference price and a clearly
# labelled benchmark range rather than pretending to have a learned model.
GRADE_ADJUSTMENT_PCT = {"A": 0.05, "B": 0.0, "C": -0.05}
RANGE_SPREAD_PCT = 0.05

RETAKE_TIP_KEYS = [
    "use_daylight", "keep_crop_close", "hold_steady",
    "show_multiple_pieces", "avoid_shadows", "keep_centered",
]


class UnsupportedCropError(Exception):
    pass


def _decode_image(image_bytes: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image)  # respect phone camera orientation metadata
    image = image.convert("RGB")
    if max(image.size) > MAX_IMAGE_DIMENSION:
        image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)
    return image


def _to_data_url(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=85)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def get_market_reference_price(destination_id: int, crop_type: str) -> dict:
    """Latest real row from PriceHistory -- always labelled SYNTHETIC here
    because every destination in this project is seeded/synthetic data (see
    Destination.is_synthetic, DataSources page). Never claims LIVE/VERIFIED
    for data that isn't -- see spec section 12."""
    session = SessionLocal()
    try:
        destination = session.get(Destination, destination_id)
        if destination is None:
            return {"error": f"destination_id {destination_id} not found"}
        row = (
            session.query(PriceHistory)
            .filter(PriceHistory.destination_id == destination_id, PriceHistory.crop_type == crop_type)
            .order_by(PriceHistory.recorded_date.desc())
            .first()
        )
        if row is None:
            return {"error": "No price history for this crop at this market."}
        days_old = (datetime.date.today() - row.recorded_date).days
        return {
            "destination_name": destination.name,
            "price_per_kg": round(float(row.price_per_kg), 2),
            "recorded_date": row.recorded_date.isoformat(),
            "days_old": days_old,
            "status": "SYNTHETIC" if destination.is_synthetic else "BENCHMARK",
        }
    finally:
        session.close()


def calculate_asking_price_range(reference_price_per_kg: float, grade: str) -> dict:
    adjustment_pct = GRADE_ADJUSTMENT_PCT.get(grade, 0.0)
    center = reference_price_per_kg * (1 + adjustment_pct)
    low = center * (1 - RANGE_SPREAD_PCT)
    high = center * (1 + RANGE_SPREAD_PCT)
    return {
        "reference_price_per_kg": round(reference_price_per_kg, 2),
        "grade": grade,
        "grade_adjustment_pct": round(adjustment_pct * 100, 1),
        "suggested_low": round(low, 2),
        "suggested_high": round(high, 2),
        "methodology": (
            f"Reference price x (1 {'+' if adjustment_pct >= 0 else ''}{adjustment_pct * 100:.0f}% for grade "
            f"{grade}), then a +/-{RANGE_SPREAD_PCT * 100:.0f}% illustrative band. The grade adjustment is a "
            "documented benchmark, not derived from verified historical transaction data -- none exists in "
            "this project yet. Actual selling price depends on mandi inspection, demand, quantity and buyer."
        ),
        "status": "BENCHMARK",
    }


def analyze_photo(image_bytes: bytes, crop_type: str, batch_id: int | None = None,
                   destination_id: int | None = None) -> dict:
    if crop_type not in VALID_CROP_TYPES:
        raise UnsupportedCropError(crop_type)

    image = _decode_image(image_bytes)
    quality = image_quality.assess_quality(image)

    if quality["overall"] == "POOR":
        return {
            "status": "retake_requested",
            "crop_type": crop_type,
            "quality": quality,
            "retake_tip_keys": RETAKE_TIP_KEYS,
        }

    enhancement = image_enhancement.enhance(image, quality)
    enhanced_image = enhancement["image"]
    grade_result = visual_grade.assess_visual_grade(enhanced_image)

    reliability = "High" if quality["overall"] == "GOOD" else "Medium"

    result = {
        "status": "ok",
        "crop_type": crop_type,
        "quality": quality,
        "reliability": reliability,
        "enhancement": {"applied": enhancement["applied"], "note": enhancement["note"]},
        "original_image": _to_data_url(image),
        "enhanced_image": _to_data_url(enhanced_image) if enhancement["applied"] else None,
        "visual_grade": grade_result,
    }

    visual_defect_score = round(1.0 - grade_result["score"] / 100.0, 3)
    result["visual_defect_score"] = visual_defect_score

    if batch_id is not None:
        try:
            result["spoilage_risk"] = what_if_risk(batch_id, visual_defect_score=visual_defect_score)
        except BatchNotFoundError:
            result["spoilage_risk"] = {"error": "Batch not found."}

        try:
            candidates = rank_destinations(batch_id, visual_defect_score=visual_defect_score)["destinations"]
            result["markets"] = candidates
            if candidates:
                top = candidates[0]
                market_ref = get_market_reference_price(top["destination_id"], crop_type)
                if "error" not in market_ref:
                    result["market_reference"] = market_ref
                    result["price_range"] = calculate_asking_price_range(market_ref["price_per_kg"], grade_result["grade"])
        except BatchNotFoundError:
            result["markets"] = []
    elif destination_id is not None:
        market_ref = get_market_reference_price(destination_id, crop_type)
        if "error" not in market_ref:
            result["market_reference"] = market_ref
            result["price_range"] = calculate_asking_price_range(market_ref["price_per_kg"], grade_result["grade"])

    return result
