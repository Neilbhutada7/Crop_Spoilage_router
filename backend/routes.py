import datetime

from flask import Blueprint, jsonify, request, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from db import SessionLocal
from models import Destination, HarvestBatch, Notification, PriceHistory
from seed.farm_locations import FARM_LOCATIONS
from services.ai_assistant_service import answer_question
from services.auth_service import AuthError, get_user, login, signup
from services.batch_history_service import BatchNotFoundError as HistoryBatchNotFoundError
from services.batch_history_service import get_predicted_vs_actual, list_batches, mark_batch_sold
from services.batch_service import VALID_CROP_TYPES, ValidationError, create_batch
from services.destination_service import BatchNotFoundError as DestBatchNotFoundError
from services.destination_service import availability_status, rank_destinations
from services.gpt_assistant_service import GPTUnavailableError, answer_with_gpt, is_gpt_configured
from services.notification_service import NotificationService
from services.model_info_service import get_model_info
from services.photo_analysis_service import UnsupportedCropError, analyze_photo
from services.risk_service import BatchNotFoundError as RiskBatchNotFoundError
from services.risk_service import assess_risk, forecast_risk
from services.weather_service import get_daily_forecast, get_weather

api = Blueprint("api", __name__, url_prefix="/api")
notification_service = NotificationService()
limiter = Limiter(key_func=get_remote_address)


@api.post("/auth/signup")
def signup_route():
    payload = request.get_json(silent=True) or {}
    try:
        user = signup(payload.get("username"), payload.get("password"), payload.get("full_name"))
    except AuthError as exc:
        return jsonify({"error": str(exc)}), 400
    session["user_id"] = user["id"]
    return jsonify(user), 201


@api.post("/auth/login")
def login_route():
    payload = request.get_json(silent=True) or {}
    try:
        user = login(payload.get("username"), payload.get("password"))
    except AuthError as exc:
        return jsonify({"error": str(exc)}), 401
    session["user_id"] = user["id"]
    return jsonify(user)


@api.post("/auth/logout")
def logout_route():
    session.clear()
    return jsonify({"status": "ok"})


@api.get("/auth/me")
def me_route():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    user = get_user(user_id)
    if user is None:
        session.clear()
        return jsonify({"error": "Not logged in"}), 401
    return jsonify(user)


@api.get("/health")
def health():
    return jsonify({"status": "ok"})


@api.get("/farm-locations")
def farm_locations():
    return jsonify(FARM_LOCATIONS)


@api.get("/destinations")
def list_destinations():
    session = SessionLocal()
    try:
        rows = session.query(Destination).all()
        return jsonify([
            {
                "id": d.id,
                "name": d.name,
                "type": d.type,
                "latitude": float(d.latitude),
                "longitude": float(d.longitude),
                "capacity_kg": float(d.capacity_kg),
                "base_price_per_kg": float(d.base_price_per_kg),
                "state": d.state,
                "is_synthetic": d.is_synthetic,
                "available_capacity_kg": float(d.available_capacity_kg) if d.available_capacity_kg is not None else None,
                "availability_status": availability_status(d.available_capacity_kg, d.capacity_kg),
                "availability_updated_at": d.availability_updated_at.isoformat() if d.availability_updated_at else None,
                "availability_source": d.availability_source,
            }
            for d in rows
        ])
    finally:
        session.close()


@api.get("/destinations/<int:destination_id>/price-history")
def destination_price_history_route(destination_id):
    crop_type = request.args.get("crop")
    if crop_type not in VALID_CROP_TYPES:
        return jsonify({"error": f"crop query param must be one of {VALID_CROP_TYPES}"}), 400

    session = SessionLocal()
    try:
        destination = session.get(Destination, destination_id)
        if destination is None:
            return jsonify({"error": f"destinations.id={destination_id} not found"}), 404

        rows = (
            session.query(PriceHistory)
            .filter(
                PriceHistory.destination_id == destination_id,
                PriceHistory.crop_type == crop_type,
            )
            .order_by(PriceHistory.recorded_date)
            .all()
        )
        return jsonify([
            {"recorded_date": r.recorded_date.isoformat(), "price_per_kg": float(r.price_per_kg)}
            for r in rows
        ])
    finally:
        session.close()


def _farm_name_for(lat, lon):
    for loc in FARM_LOCATIONS:
        if abs(loc["latitude"] - lat) < 0.001 and abs(loc["longitude"] - lon) < 0.001:
            return loc["name"]
    return None


@api.get("/batches")
def list_batches_route():
    batches = list_batches()
    for b in batches:
        b["farm_name"] = _farm_name_for(b["farm_latitude"], b["farm_longitude"])
    return jsonify(batches)


@api.post("/batches/<int:batch_id>/sold")
def mark_batch_sold_route(batch_id):
    payload = request.get_json(silent=True) or {}
    actual = {}
    for field, caster in (
        ("actual_price_per_kg", float), ("actual_quantity_sold_kg", float),
        ("actual_quantity_spoiled_kg", float), ("actual_transport_cost", float),
        ("actual_storage_cost", float), ("sold_destination_name", str),
        ("sold_destination_id", int),
    ):
        value = payload.get(field)
        if value is None or value == "":
            continue
        try:
            actual[field] = caster(value)
        except (TypeError, ValueError):
            return jsonify({"error": f"{field} must be a valid {caster.__name__}"}), 400

    try:
        result = mark_batch_sold(batch_id, actual=actual)
    except HistoryBatchNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(result)


@api.get("/batches/<int:batch_id>/predicted-vs-actual")
def predicted_vs_actual_route(batch_id):
    try:
        result = get_predicted_vs_actual(batch_id)
    except HistoryBatchNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    if result is None:
        return jsonify({"batch_id": batch_id, "has_actual_outcome": False})
    return jsonify({**result, "has_actual_outcome": True})


@api.post("/batches")
def create_batch_route():
    payload = request.get_json(silent=True)
    try:
        batch = create_batch(payload)
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(batch), 201


@api.get("/batches/<int:batch_id>/risk")
def batch_risk_route(batch_id):
    try:
        result = assess_risk(batch_id)
    except RiskBatchNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(result)


@api.get("/batches/<int:batch_id>/destinations")
def batch_destinations_route(batch_id):
    risk_appetite = request.args.get("risk_appetite", "balanced")
    try:
        risk_result = assess_risk(batch_id)
        result = rank_destinations(batch_id, risk_appetite=risk_appetite)
    except (RiskBatchNotFoundError, DestBatchNotFoundError) as exc:
        return jsonify({"error": str(exc)}), 404

    ranked = result["destinations"]
    if ranked:
        session = SessionLocal()
        try:
            batch = session.get(HarvestBatch, batch_id)
            crop_label = batch.crop_type.capitalize() if batch else "Batch"
        finally:
            session.close()
        top = ranked[0]
        message = (
            f"{crop_label} batch #{batch_id}: {risk_result['risk_label']} risk "
            f"({risk_result['risk_score']}/100). Recommended: {top['name']} "
            f"({top['distance_km']} km, Rs {top['expected_price']}/kg)."
        )
        notification_service.send_alert(batch_id, message)

    return jsonify({
        "batch_id": batch_id,
        "risk_score": risk_result["risk_score"],
        "risk_label": risk_result["risk_label"],
        "destinations": ranked,
        "value_uplift": result["value_uplift"],
    })


@api.get("/batches/<int:batch_id>/risk-forecast")
def batch_risk_forecast_route(batch_id):
    days = request.args.get("days", default=6, type=int)
    if days is None or not (1 <= days <= 14):
        return jsonify({"error": "days query param must be an integer between 1 and 14"}), 400
    try:
        points = forecast_risk(batch_id, horizon_days=days)
    except RiskBatchNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"batch_id": batch_id, "forecast": points})


@api.get("/model-info")
def model_info_route():
    return jsonify(get_model_info())


@api.get("/notifications")
def list_notifications_route():
    session = SessionLocal()
    try:
        rows = (
            session.query(Notification)
            .order_by(Notification.created_at.desc())
            .limit(50)
            .all()
        )
        return jsonify([
            {
                "id": n.id,
                "batch_id": n.batch_id,
                "message": n.message,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in rows
        ])
    finally:
        session.close()


@api.get("/weather")
def weather_route():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    date_str = request.args.get("date")

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon query parameters are required"}), 400
    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numbers"}), 400

    if date_str:
        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return jsonify({"error": "date must be an ISO date string (YYYY-MM-DD)"}), 400
    else:
        target_date = datetime.date.today()

    weather = get_weather(lat, lon, target_date)
    weather["date"] = target_date.isoformat()
    return jsonify(weather)


@api.get("/weather-forecast")
def weather_forecast_route():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    days = request.args.get("days", default=5, type=int)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon query parameters are required"}), 400
    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numbers"}), 400
    if days is None or not (1 <= days <= 16):
        return jsonify({"error": "days query param must be an integer between 1 and 16"}), 400

    return jsonify({"days": get_daily_forecast(lat, lon, days)})


@api.post("/assistant/ask")
@limiter.limit("10 per minute")
def assistant_ask_route():
    payload = request.get_json(silent=True) or {}
    question = payload.get("question")
    if not question or not isinstance(question, str):
        return jsonify({"error": "question (string) is required"}), 400

    lat = payload.get("farm_latitude")
    lon = payload.get("farm_longitude")
    try:
        lat = float(lat) if lat is not None else None
        lon = float(lon) if lon is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "farm_latitude/farm_longitude must be numbers"}), 400

    lang = payload.get("lang", "en")
    batch_id = payload.get("batch_id")
    try:
        batch_id = int(batch_id) if batch_id is not None else None
    except (TypeError, ValueError):
        batch_id = None
    history = payload.get("history") if isinstance(payload.get("history"), list) else None

    # GPT explains/converses using the real batch, risk and market data
    # (see gpt_assistant_service.py); it never replaces the XGBoost model
    # or the destination optimizer. If no key is configured, or the GPT
    # call fails for any reason (rate limit, timeout, network), fall back
    # to the rule-based responder so the assistant never goes offline.
    if is_gpt_configured():
        try:
            result = answer_with_gpt(question, batch_id=batch_id, lang=lang, history=history)
            return jsonify({**result, "engine": "gpt"})
        except GPTUnavailableError:
            pass

    result = answer_question(question, farm_latitude=lat, farm_longitude=lon, lang=lang, batch_id=batch_id)
    return jsonify({**result, "engine": "rules"})


@api.post("/photo/analyze")
@limiter.limit("10 per minute")
def photo_analyze_route():
    if "image" not in request.files:
        return jsonify({"error": "image file is required (multipart field 'image')"}), 400
    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"error": "image file is required (multipart field 'image')"}), 400

    crop_type = request.form.get("crop_type")
    if not crop_type or crop_type not in VALID_CROP_TYPES:
        return jsonify({"error": f"crop_type must be one of {VALID_CROP_TYPES}"}), 400

    batch_id = request.form.get("batch_id")
    try:
        batch_id = int(batch_id) if batch_id else None
    except ValueError:
        batch_id = None
    destination_id = request.form.get("destination_id")
    try:
        destination_id = int(destination_id) if destination_id else None
    except ValueError:
        destination_id = None

    image_bytes = file.read()
    if not image_bytes:
        return jsonify({"error": "Uploaded file is empty."}), 400

    try:
        result = analyze_photo(image_bytes, crop_type, batch_id=batch_id, destination_id=destination_id)
    except UnsupportedCropError:
        return jsonify({"error": f"crop_type must be one of {VALID_CROP_TYPES}"}), 400
    except Exception:
        # Covers a corrupt/non-image upload (PIL raises various error types
        # depending on what was sent) -- never leak a raw parser traceback.
        return jsonify({"error": "Could not read that image. Please try a different photo."}), 400

    return jsonify(result)
