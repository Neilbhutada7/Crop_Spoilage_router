import datetime
import os
import sys

_ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from decay_constants import CROP_TYPES as VALID_CROP_TYPES  # noqa: E402

from db import SessionLocal  # noqa: E402
from models import HarvestBatch  # noqa: E402


class ValidationError(Exception):
    pass


def _require(condition: bool, message: str):
    if not condition:
        raise ValidationError(message)


def _parse_date(value) -> datetime.date:
    try:
        return datetime.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ValidationError("harvest_date must be an ISO date string (YYYY-MM-DD)")


def create_batch(payload: dict) -> dict:
    _require(isinstance(payload, dict), "Request body must be a JSON object")

    for field in ("crop_type", "harvest_date", "quantity_kg", "farm_latitude", "farm_longitude"):
        _require(field in payload and payload[field] is not None, f"Missing required field: {field}")

    crop_type = payload["crop_type"]
    _require(
        isinstance(crop_type, str) and crop_type in VALID_CROP_TYPES,
        f"Invalid crop_type '{crop_type}'. Must be one of {VALID_CROP_TYPES}",
    )

    harvest_date = _parse_date(payload["harvest_date"])
    _require(harvest_date <= datetime.date.today(), "harvest_date cannot be in the future")

    try:
        quantity_kg = float(payload["quantity_kg"])
    except (TypeError, ValueError):
        raise ValidationError("quantity_kg must be a number")
    _require(quantity_kg > 0, "quantity_kg must be greater than 0")

    try:
        farm_latitude = float(payload["farm_latitude"])
        farm_longitude = float(payload["farm_longitude"])
    except (TypeError, ValueError):
        raise ValidationError("farm_latitude/farm_longitude must be numbers")
    _require(-90 <= farm_latitude <= 90, "farm_latitude must be between -90 and 90")
    _require(-180 <= farm_longitude <= 180, "farm_longitude must be between -180 and 180")

    session = SessionLocal()
    try:
        batch = HarvestBatch(
            crop_type=crop_type,
            harvest_date=harvest_date,
            quantity_kg=quantity_kg,
            farm_latitude=farm_latitude,
            farm_longitude=farm_longitude,
        )
        session.add(batch)
        session.commit()
        return {
            "id": batch.id,
            "crop_type": batch.crop_type,
            "harvest_date": batch.harvest_date.isoformat(),
            "quantity_kg": float(batch.quantity_kg),
            "farm_latitude": float(batch.farm_latitude),
            "farm_longitude": float(batch.farm_longitude),
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
        }
    finally:
        session.close()
