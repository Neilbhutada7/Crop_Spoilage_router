"""
Function-calling tools exposed to the GPT layer (gpt_assistant_service.py).

Every tool here wraps a real, already-tested backend function -- the same
ones the REST API uses (risk_service, destination_service, weather_service).
GPT never computes a risk score, price, distance or expected value itself;
it can only ask for one of these tools to be run, and the tool returns the
actual number from the real spoilage model / optimizer. This is what
prevents the assistant from inventing project data (see gpt_assistant_service
system prompt, and the spec's "GPT must not invent project data" rule).

Each tool returns a plain JSON-serialisable dict, or
{"error": "..."} if the requested data doesn't exist -- the system prompt
instructs GPT to say so honestly rather than guess when it sees an error.
"""
import datetime

from db import SessionLocal
from models import HarvestBatch
from services.destination_service import BatchNotFoundError as DestBatchNotFoundError
from services.destination_service import rank_destinations
from services.risk_service import BatchNotFoundError as RiskBatchNotFoundError
from services.risk_service import assess_risk, what_if_risk


def _batch_not_found(batch_id):
    return {"error": f"No batch found with id {batch_id}."}


def get_current_batch(batch_id: int) -> dict:
    session = SessionLocal()
    try:
        batch = session.get(HarvestBatch, batch_id)
        if batch is None:
            return _batch_not_found(batch_id)
        days_since_harvest = max((datetime.date.today() - batch.harvest_date).days, 0)
        return {
            "batch_id": batch.id,
            "crop_type": batch.crop_type,
            "quantity_kg": float(batch.quantity_kg),
            "harvest_date": batch.harvest_date.isoformat(),
            "days_since_harvest": days_since_harvest,
            "farm_latitude": float(batch.farm_latitude),
            "farm_longitude": float(batch.farm_longitude),
        }
    finally:
        session.close()


def predict_spoilage(batch_id: int) -> dict:
    try:
        result = assess_risk(batch_id)
    except RiskBatchNotFoundError:
        return _batch_not_found(batch_id)
    return {
        "risk_score": result["risk_score"],
        "risk_label": result["risk_label"],
        "temperature_c": result["temperature_c"],
        "humidity_pct": result["humidity_pct"],
        "days_since_harvest": result["days_since_harvest"],
        "top_reasons": [r["text"] for r in result["explanation"]["reasons"][:2]],
    }


def _market_summary(d: dict) -> dict:
    return {
        "destination_id": d["destination_id"],
        "name": d["name"],
        "type": d["type"],
        "distance_km": d["distance_km"],
        "travel_time_hours": d["travel_time_hours"],
        "price_per_kg": d["expected_price"],
        "transport_cost": d["transport_cost_total"],
        "arrival_risk_pct": d["arrival_risk_score"],
        "expected_spoilage_loss": d["expected_spoilage_loss"],
        "expected_realised_value": d["expected_realised_value"],
        "rank": d["rank"],
    }


def get_candidate_markets(batch_id: int) -> dict:
    try:
        candidates = rank_destinations(batch_id)["destinations"]
    except DestBatchNotFoundError:
        return _batch_not_found(batch_id)
    if not candidates:
        return {"markets": [], "note": "No markets found within the search radius for this batch."}
    return {"markets": [_market_summary(d) for d in candidates]}


# Same underlying data as get_candidate_markets -- kept as its own tool
# (rather than only relying on GPT re-reading the same list) so a direct
# "compare markets" question maps onto an explicit, self-describing call.
def compare_markets(batch_id: int) -> dict:
    return get_candidate_markets(batch_id)


def get_best_destination(batch_id: int) -> dict:
    result = get_candidate_markets(batch_id)
    if "error" in result:
        return result
    markets = result["markets"]
    if not markets:
        return {"note": "No markets found within the search radius for this batch."}
    return {"best_market": next(m for m in markets if m["rank"] == 1)}


def calculate_route(batch_id: int, destination_id: int) -> dict:
    result = get_candidate_markets(batch_id)
    if "error" in result:
        return result
    match = next((m for m in result["markets"] if m["destination_id"] == destination_id), None)
    if match is None:
        return {"error": f"destination_id {destination_id} is not a candidate market for this batch."}
    return {
        "name": match["name"],
        "distance_km": match["distance_km"],
        "travel_time_hours": match["travel_time_hours"],
        "transport_cost": match["transport_cost"],
        "arrival_risk_pct": match["arrival_risk_pct"],
    }


def calculate_expected_value(batch_id: int, destination_id: int) -> dict:
    result = get_candidate_markets(batch_id)
    if "error" in result:
        return result
    match = next((m for m in result["markets"] if m["destination_id"] == destination_id), None)
    if match is None:
        return {"error": f"destination_id {destination_id} is not a candidate market for this batch."}
    return {
        "name": match["name"],
        "price_per_kg": match["price_per_kg"],
        "transport_cost": match["transport_cost"],
        "expected_spoilage_loss": match["expected_spoilage_loss"],
        "expected_realised_value": match["expected_realised_value"],
    }


def what_if(batch_id: int, temperature_c: float | None = None,
            humidity_pct: float | None = None, days_offset: int = 0) -> dict:
    """Real recomputation (not a guess) of both risk and the market ranking
    under a hypothetical change -- e.g. "what if it gets hotter" or "what if
    I wait a day". Returns before/after so GPT can show the real delta."""
    try:
        before_risk = assess_risk(batch_id)
        before_markets = rank_destinations(batch_id)["destinations"]
    except (RiskBatchNotFoundError, DestBatchNotFoundError):
        return _batch_not_found(batch_id)

    after_risk = what_if_risk(batch_id, temperature_c=temperature_c, humidity_pct=humidity_pct, days_offset=days_offset)
    after_markets = rank_destinations(batch_id, days_offset=days_offset, temperature_c=temperature_c, humidity_pct=humidity_pct)["destinations"]

    def top(markets):
        return next((m for m in markets if m["rank"] == 1), None)

    before_top = top(before_markets)
    after_top = top(after_markets)

    return {
        "before": {
            "risk_score": before_risk["risk_score"],
            "risk_label": before_risk["risk_label"],
            "best_market": before_top["name"] if before_top else None,
            "expected_realised_value": before_top["expected_realised_value"] if before_top else None,
        },
        "after": {
            "risk_score": after_risk["risk_score"],
            "risk_label": after_risk["risk_label"],
            "best_market": after_top["name"] if after_top else None,
            "expected_realised_value": after_top["expected_realised_value"] if after_top else None,
        },
    }


TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_batch",
            "description": "Get the crop, quantity, harvest date and location for the farmer's currently selected batch.",
            "parameters": {
                "type": "object",
                "properties": {"batch_id": {"type": "integer"}},
                "required": ["batch_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "predict_spoilage",
            "description": "Get the real, current spoilage risk score (0-100) for the batch from the trained XGBoost model, with the top reasons behind it.",
            "parameters": {
                "type": "object",
                "properties": {"batch_id": {"type": "integer"}},
                "required": ["batch_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_candidate_markets",
            "description": "Get every real candidate market/storage facility for this batch, each with its own price, distance, travel time, transport cost, arrival risk and expected realised value.",
            "parameters": {
                "type": "object",
                "properties": {"batch_id": {"type": "integer"}},
                "required": ["batch_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_markets",
            "description": "Compare all real candidate markets for this batch side by side. Same data as get_candidate_markets.",
            "parameters": {
                "type": "object",
                "properties": {"batch_id": {"type": "integer"}},
                "required": ["batch_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_best_destination",
            "description": "Get the single recommended market chosen by AgriRoute AI's optimizer (highest expected realised value) for this batch.",
            "parameters": {
                "type": "object",
                "properties": {"batch_id": {"type": "integer"}},
                "required": ["batch_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_route",
            "description": "Get the real distance, travel time, transport cost and arrival risk for one specific candidate market.",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_id": {"type": "integer"},
                    "destination_id": {"type": "integer", "description": "The destination_id from get_candidate_markets."},
                },
                "required": ["batch_id", "destination_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_expected_value",
            "description": "Get the real price, transport cost, expected spoilage loss and expected realised value for one specific candidate market.",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_id": {"type": "integer"},
                    "destination_id": {"type": "integer", "description": "The destination_id from get_candidate_markets."},
                },
                "required": ["batch_id", "destination_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "what_if",
            "description": (
                "Recompute the batch's real risk and best market under a hypothetical change -- a different "
                "temperature, different humidity, or waiting N more days before routing. Returns real "
                "before/after numbers from the actual model, never invented. Use this for any 'what if...' question."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_id": {"type": "integer"},
                    "temperature_c": {"type": "number", "description": "Hypothetical temperature in Celsius. Omit to keep the current/live temperature."},
                    "humidity_pct": {"type": "number", "description": "Hypothetical humidity percentage. Omit to keep the current/live humidity."},
                    "days_offset": {"type": "integer", "description": "Extra days since harvest to simulate (e.g. 1 for 'what if I wait a day'). Defaults to 0."},
                },
                "required": ["batch_id"],
            },
        },
    },
]

TOOL_DISPATCH = {
    "get_current_batch": get_current_batch,
    "predict_spoilage": predict_spoilage,
    "get_candidate_markets": get_candidate_markets,
    "compare_markets": compare_markets,
    "get_best_destination": get_best_destination,
    "calculate_route": calculate_route,
    "calculate_expected_value": calculate_expected_value,
    "what_if": what_if,
}
