import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    DATABASE_URL = os.environ.get(
        "DATABASE_URL",
        "postgresql://spoilage:spoilage@localhost:5432/spoilage_router",
    )
    # Radius searched for candidate destinations around a farm location.
    DESTINATION_SEARCH_RADIUS_KM = float(os.environ.get("DESTINATION_SEARCH_RADIUS_KM", 250))
    # INR per kg per km, illustrative transport cost estimate (small truck / tempo rates).
    TRANSPORT_COST_PER_KG_PER_KM = float(os.environ.get("TRANSPORT_COST_PER_KG_PER_KM", 0.012))
    # INR per kg flat storage handling cost applied to storage_facility destinations.
    STORAGE_HANDLING_COST_PER_KG = float(os.environ.get("STORAGE_HANDLING_COST_PER_KG", 0.5))
    # Signs the session cookie used for login. Demo default is fine for local/hackathon
    # use; set a real random value via env var for anything beyond that.
    SECRET_KEY = os.environ.get("SECRET_KEY", "spoilage-router-dev-secret-change-me")
    # Illustrative average road speed for a loaded small truck/tempo on Indian
    # state/district roads -- used only to estimate travel time from distance,
    # not a live traffic/routing service.
    AVERAGE_TRUCK_SPEED_KMH = float(os.environ.get("AVERAGE_TRUCK_SPEED_KMH", 35))
    # GPT layer for the AI Assistant (explanation/conversation only -- never
    # the spoilage model itself, see services/gpt_assistant_service.py).
    # Empty by default: the assistant falls back to the rule-based
    # ai_assistant_service.py responder when this isn't set, so the app
    # works fully without an OpenAI account.
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    # Government of India's official Agmarknet daily mandi price feed
    # (data.gov.in resource 9ef84268-d588-465a-a308-a864a43d0070), used by
    # services/mandi_price_service.py for real live market prices. Empty by
    # default: falls back to data.gov.in's own published sample key, which
    # works but is shared/rate-limited -- get a free personal key at
    # https://data.gov.in/user/register for reliable use beyond a demo.
    DATA_GOV_API_KEY = os.environ.get("DATA_GOV_API_KEY", "")
