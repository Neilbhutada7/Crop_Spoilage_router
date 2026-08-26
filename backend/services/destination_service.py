"""
Destination ranking service.

For each candidate destination, independently:

    Selling Revenue          = Market Price (this destination) x Quantity
    Transport Cost           = Distance x Cost-per-kg-per-km x Quantity
    Storage Cost              = flat handling fee x Quantity (storage_facility only)
    Arrival Spoilage Risk     = spoilage model evaluated at THIS destination's
                                own transit time (see _arrival_risk below) --
                                NOT the batch's single "today" risk reused
                                across every row.
    Expected Spoilage Loss   = Spoilage Probability x Value At Risk
                                (Value At Risk = Selling Revenue at this
                                destination; Spoilage Probability = arrival
                                risk, dampened by RISK_PRICE_PENALTY for
                                destination types where decay is arrested
                                after arrival -- see that constant.)
    Expected Realised Value  = Selling Revenue - Transport Cost - Storage Cost
                                - Expected Spoilage Loss

Expected Spoilage Loss is always >= 0 (a probability times a non-negative
rupee amount); it is subtracted once, here, to produce Expected Realised
Value -- nothing downstream should subtract it again.

Nearby candidates come from a PostGIS spatial query (ST_DWithin /
ST_Distance on the geography column) rather than a naive Python distance
loop -- this is the "spatial query" the spec calls out PostGIS for.
"""
import datetime
import os
import sys

from sqlalchemy import func

from config import Config
from db import SessionLocal
from models import Destination, HarvestBatch, PriceHistory

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ML_DIR = os.path.join(_BACKEND_DIR, "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from predict import predict_risk, risk_label  # noqa: E402
from services.mandi_price_service import get_live_price  # noqa: E402
from services.weather_service import get_weather  # noqa: E402

# Fraction of the model's predicted arrival spoilage risk that actually
# erodes realised sale value at each destination type. A mandi sale happens
# immediately on arrival, so the full predicted risk hits the price; cold
# storage arrests further decay after arrival, so only the risk accumulated
# in transit (a documented, smaller fraction) carries through to the sale.
# This is a domain assumption, not a fitted parameter -- see MODEL.md.
RISK_PRICE_PENALTY = {
    "mandi": 0.40,
    "storage_facility": 0.15,
}
DEFAULT_RISK_PRICE_PENALTY = 0.30


class BatchNotFoundError(Exception):
    pass


# Fraction of total capacity below which a storage facility is considered
# "limited" rather than fully open -- a documented threshold, not a fitted
# parameter. available_capacity_kg itself is demo/illustrative data (see
# Destination.availability_source), never a live occupancy feed.
LIMITED_SPACE_THRESHOLD_PCT = 0.15


def availability_status(available_capacity_kg, capacity_kg) -> str | None:
    if available_capacity_kg is None:
        return None
    available = float(available_capacity_kg)
    if available <= 0:
        return "FULL"
    if capacity_kg and available / float(capacity_kg) < LIMITED_SPACE_THRESHOLD_PCT:
        return "LIMITED"
    return "OPEN"


def _price_for_destination(dest: Destination, crop_type: str, price_history_map: dict) -> dict:
    """Resolves the price to use for this destination, honestly labeled by
    where it actually came from -- tried in order: (1) today's real
    Agmarknet modal price for this crop in this destination's state, (2)
    the most recent seeded price_history row, (3) the destination's static
    seed base_price_per_kg. Never blends or averages across sources."""
    live = get_live_price(crop_type, dest.state, dest.name)
    if live is not None:
        return {
            "price_per_kg": live["price_per_kg"],
            "price_source": "LIVE_AGMARKNET",
            "price_is_synthetic": False,
            "price_detail": live,
        }

    row = price_history_map.get(dest.id)
    if row is not None:
        return {
            "price_per_kg": float(row.price_per_kg),
            "price_source": "SEEDED_HISTORY",
            "price_is_synthetic": True,
            "price_detail": None,
        }

    return {
        "price_per_kg": float(dest.base_price_per_kg),
        "price_source": "SYNTHETIC_BASE",
        "price_is_synthetic": True,
        "price_detail": None,
    }


def _arrival_risk(batch: HarvestBatch, weather: dict, days_since_harvest_now: float, travel_time_hours: float,
                   visual_defect_score: float = 0.0) -> dict:
    """Destination-specific arrival risk: the SAME trained regressor the
    dashboard uses, with this destination's own transit time folded into
    days_since_harvest (the batch will genuinely be that much older by the
    time it arrives here). The currently deployed model (seed_and_train.py,
    trained on fresh_produce_wastage_dataset.csv) has no separate
    transit_hours feature at all -- an earlier synthetic-data model did, and
    predict_risk() used to accept a transit_hours argument for it, but
    passing that to the current model was silently a no-op: every
    destination for a batch got the exact same arrival_risk_score
    regardless of distance, contradicting this function's own name. Folding
    transit time into days_since_harvest uses a feature the deployed model
    actually learned from, and is physically the correct effect anyway
    (spoilage depends on total elapsed time, not on labeling some of it
    "transit"). Today's weather at the farm is used as the best available
    proxy for in-transit/arrival conditions (documented assumption -- there
    is no per-route weather feed). visual_defect_score defaults to 0.0 (no
    photo analysed) for every ordinary call; the photo analyzer passes the
    real heuristic score from vision/visual_grade.py when ranking markets
    for a batch that has one."""
    days_since_harvest_at_arrival = days_since_harvest_now + travel_time_hours / 24.0
    score = predict_risk(
        crop_type=batch.crop_type,
        temperature_c=weather["temperature_c"],
        humidity_pct=weather["humidity_pct"],
        days_since_harvest=days_since_harvest_at_arrival,
        visual_defect_score=visual_defect_score,
    )
    return {
        "risk_score": round(score, 1),
        "risk_label": risk_label(score),
        "days_since_harvest_at_arrival": round(days_since_harvest_at_arrival, 3),
    }


def _rationale(candidate: dict, all_candidates: list, rank: int) -> str:
    closest = min(all_candidates, key=lambda c: c["distance_km"])
    priciest = max(all_candidates, key=lambda c: c["expected_price"])

    if rank == 0:
        return "Recommended: highest expected realised value after transport cost and destination-specific spoilage risk."
    if candidate is closest:
        return "Closest option, moderate price."
    if candidate is priciest:
        extra_km = round(candidate["distance_km"] - closest["distance_km"], 1)
        return f"Higher price but {extra_km}km further than the closest option."
    if candidate["type"] == "storage_facility":
        return "Cold storage slows spoilage, trading transport distance for lower risk exposure."
    return "Balanced choice: moderate price and distance."


def rank_destinations(batch_id: int, days_offset: int = 0, temperature_c: float | None = None,
                       humidity_pct: float | None = None, visual_defect_score: float = 0.0,
                       risk_appetite: str = "balanced") -> list:
    """days_offset/temperature_c/humidity_pct let a caller ask "what if" this
    batch were `days_offset` days older, or under different weather, without
    touching the database -- used by the AI Assistant's what_if tool
    (gpt_tools.py). visual_defect_score (0.0 default = no photo analysed)
    lets the photo analyzer re-rank markets using the batch's real visible
    condition. Defaults reproduce the normal, real ranking exactly."""
    session = SessionLocal()
    try:
        batch = session.get(HarvestBatch, batch_id)
        if batch is None:
            raise BatchNotFoundError(f"harvest_batches.id={batch_id} not found")

        days_since_harvest_now = max((datetime.date.today() - batch.harvest_date).days, 0) + days_offset
        weather = get_weather(float(batch.farm_latitude), float(batch.farm_longitude), datetime.date.today())
        if temperature_c is not None:
            weather = {**weather, "temperature_c": temperature_c}
        if humidity_pct is not None:
            weather = {**weather, "humidity_pct": humidity_pct}

        farm_point = func.ST_SetSRID(
            func.ST_MakePoint(float(batch.farm_longitude), float(batch.farm_latitude)), 4326
        )
        farm_geog = func.cast(farm_point, Destination.location.type)
        radius_m = Config.DESTINATION_SEARCH_RADIUS_KM * 1000

        distance_expr = func.ST_Distance(Destination.location, farm_geog).label("distance_m")
        rows = (
            session.query(Destination, distance_expr)
            .filter(func.ST_DWithin(Destination.location, farm_geog, radius_m))
            .order_by(distance_expr)
            .all()
        )

        dest_ids = [dest.id for dest, _ in rows]
        all_prices = (
            session.query(PriceHistory)
            .filter(PriceHistory.destination_id.in_(dest_ids), PriceHistory.crop_type == batch.crop_type)
            .order_by(PriceHistory.recorded_date.desc())
            .all()
        )
        price_history_map = {}
        for p in all_prices:
            if p.destination_id not in price_history_map:
                price_history_map[p.destination_id] = p

        quantity_kg = float(batch.quantity_kg)
        candidates = []
        for dest, distance_m in rows:
            distance_km = distance_m / 1000.0
            price_info = _price_for_destination(dest, batch.crop_type, price_history_map)
            expected_price = price_info["price_per_kg"]

            # Estimated from distance / an illustrative average road speed --
            # not a live routing/traffic service. See Config.AVERAGE_TRUCK_SPEED_KMH.
            travel_time_hours = distance_km / Config.AVERAGE_TRUCK_SPEED_KMH

            arrival = _arrival_risk(batch, weather, days_since_harvest_now, travel_time_hours, visual_defect_score)
            arrival_risk_score = arrival["risk_score"]

            penalty = RISK_PRICE_PENALTY.get(dest.type, DEFAULT_RISK_PRICE_PENALTY)
            spoilage_probability = (arrival_risk_score / 100.0) * penalty

            selling_revenue = expected_price * quantity_kg
            transport_cost_per_kg = distance_km * Config.TRANSPORT_COST_PER_KG_PER_KM
            transport_cost_total = transport_cost_per_kg * quantity_kg
            storage_cost_per_kg = Config.STORAGE_HANDLING_COST_PER_KG if dest.type == "storage_facility" else 0.0
            storage_cost_total = storage_cost_per_kg * quantity_kg

            value_at_risk = selling_revenue
            expected_spoilage_loss_total = spoilage_probability * value_at_risk  # always >= 0

            expected_realised_value = (
                selling_revenue - transport_cost_total - storage_cost_total - expected_spoilage_loss_total
            )

            # Apply the risk appetite multiplier purely for sorting purposes.
            # This ensures the UI displays honest, mathematically sound revenue
            # estimates while respecting the farmer's personal risk tolerance.
            if risk_appetite == "conservative":
                risk_penalty_multiplier = 3.0
                badge = "Safe Bet"
            elif risk_appetite == "aggressive":
                risk_penalty_multiplier = 0.33
                badge = "High Reward"
            else:
                risk_penalty_multiplier = 1.0
                badge = "Balanced"

            ranking_score = (
                selling_revenue - transport_cost_total - storage_cost_total - (expected_spoilage_loss_total * risk_penalty_multiplier)
            )

            candidates.append({
                "destination_id": dest.id,
                "name": dest.name,
                "type": dest.type,
                "latitude": float(dest.latitude),
                "longitude": float(dest.longitude),
                "distance_km": round(distance_km, 1),
                "travel_time_hours": round(travel_time_hours, 2),
                "expected_price": round(expected_price, 2),
                "price_source": price_info["price_source"],
                "price_is_synthetic": price_info["price_is_synthetic"],
                "price_detail": price_info["price_detail"],
                # Destination-specific: genuinely varies with this
                # destination's own transit time, not copied from "today".
                "arrival_risk_score": arrival_risk_score,
                "arrival_risk_label": arrival["risk_label"],
                "days_since_harvest_at_arrival": arrival["days_since_harvest_at_arrival"],
                # Absolute rupee figures for this batch at this destination.
                "selling_revenue": round(selling_revenue, 2),
                "value_at_risk": round(value_at_risk, 2),
                "transport_cost_total": round(transport_cost_total, 2),
                "storage_cost_total": round(storage_cost_total, 2),
                "expected_spoilage_loss": round(expected_spoilage_loss_total, 2),  # always positive
                "expected_realised_value": round(expected_realised_value, 2),
                # Per-kg fields kept for pages built against the original shape.
                "transport_cost_estimate": round(transport_cost_per_kg, 2),
                "storage_cost": round(storage_cost_per_kg, 2),
                "risk_adjustment_applied": round(expected_spoilage_loss_total / quantity_kg, 2) if quantity_kg else 0.0,
                "destination_score": round(expected_realised_value / quantity_kg, 2) if quantity_kg else 0.0,
                "estimated_net_value": round(expected_realised_value, 2),
                "capacity_kg": float(dest.capacity_kg),
                "is_synthetic": dest.is_synthetic,
                "available_capacity_kg": float(dest.available_capacity_kg) if dest.available_capacity_kg is not None else None,
                "availability_status": availability_status(dest.available_capacity_kg, dest.capacity_kg),
                "availability_updated_at": dest.availability_updated_at.isoformat() if dest.availability_updated_at else None,
                "availability_source": dest.availability_source,
                "fits_batch_quantity": dest.available_capacity_kg is None or float(dest.available_capacity_kg) >= quantity_kg,
                "ranking_score": ranking_score,
                "risk_appetite_badge": badge,
            })

        # Constraint: a storage facility without enough free space for this
        # batch isn't a real option, so it's excluded from ranking rather
        # than just shown lower -- mandis (no capacity concept tracked) and
        # facilities with enough room always pass. If this would leave zero
        # feasible destinations, fall back to the unfiltered list rather
        # than returning nothing -- an infeasible-but-visible option is more
        # useful to a farmer than an empty result.
        feasible = [c for c in candidates if c["fits_batch_quantity"]]
        if feasible:
            candidates = feasible

        candidates.sort(key=lambda c: c["ranking_score"], reverse=True)
        for rank, c in enumerate(candidates):
            c["rank"] = rank + 1
            c["one_line_rationale"] = _rationale(c, candidates, rank)

        value_uplift = None
        if len(candidates) >= 2:
            nearest = min(candidates, key=lambda c: c["distance_km"])
            top = candidates[0]
            if nearest["destination_id"] != top["destination_id"]:
                uplift_total = round(top["expected_realised_value"] - nearest["expected_realised_value"], 2)
                if uplift_total > 0:
                    value_uplift = {
                        "nearest_destination_name": nearest["name"],
                        "nearest_distance_km": nearest["distance_km"],
                        "uplift_per_kg": round(uplift_total / quantity_kg, 2) if quantity_kg else 0.0,
                        "uplift_total": uplift_total,
                    }

        return {"destinations": candidates, "value_uplift": value_uplift}
    finally:
        session.close()
