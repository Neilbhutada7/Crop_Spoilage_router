"""
Real live mandi price lookup, from the Government of India's Agmarknet
daily market-price feed published on data.gov.in (resource
9ef84268-d588-465a-a308-a864a43d0070, "Current Daily Price of Various
Commodities from Various Markets (Mandi)"). Not a scrape of anything --
this is the official open-data API, updated by the Ministry of Agriculture
roughly once a day.

get_live_price() returns None (never a guess) when the feed has no
matching record for a crop/state today, so callers always have a real
fallback path to the existing seeded price -- see destination_service.py,
which labels every price it returns with exactly which of the two sources
it came from.
"""
import datetime
import re
import sys
import time

import requests

from config import Config

AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"
AGMARKNET_URL = f"https://api.data.gov.in/resource/{AGMARKNET_RESOURCE_ID}"

# data.gov.in's own published sample key (see https://data.gov.in/help) --
# works out of the box for a demo, but it's shared across every app that
# hasn't registered its own key yet, so it's aggressively rate-limited.
# Config.DATA_GOV_API_KEY (a free personal key) is always preferred when set.
_SAMPLE_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"

# This API's filters[commodity]=... is an exact-match filter (the field is
# indexed as a keyword, not full text) and Agmarknet's own commodity naming
# doesn't line up cleanly with this app's crop_type slugs (e.g. chillies are
# split across several exact spellings). Rather than guess the one exact
# government string and silently return zero rows on a mismatch, each crop
# maps to keywords checked against the commodity name client-side, against
# the state's full unfiltered-by-commodity record set.
CROP_COMMODITY_KEYWORDS = {
    "tomato": ["tomato"],
    "onion": ["onion"],
    "banana": ["banana"],
    "potato": ["potato"],
    "mango": ["mango"],
    "chili": ["chilli", "chili", "chilly"],
}

# Agmarknet publishes once a day, so refetching more often than this just
# burns rate-limit budget for no new data. Cached per state (not per
# destination/request) -- a handful of Indian states cover this app's
# entire seeded destination set.
_CACHE_TTL_SECONDS = 6 * 60 * 60
_cache: dict[str, tuple[float, list]] = {}


def _fetch_state_records(state: str) -> list:
    now = time.time()
    cached = _cache.get(state)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    api_key = Config.DATA_GOV_API_KEY or _SAMPLE_API_KEY
    records = []
    try:
        resp = requests.get(AGMARKNET_URL, params={
            "api-key": api_key,
            "format": "json",
            "limit": 1000,
            "filters[state]": state,
        }, timeout=5)
        resp.raise_for_status()
        records = resp.json().get("records", [])
    except (requests.RequestException, ValueError) as exc:
        print(f"[mandi_price_service] Agmarknet request failed for state={state}: {exc}", file=sys.stderr)

    _cache[state] = (now, records)
    return records


def _parse_price(value) -> float | None:
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    return price if price > 0 else None


def _town_from_destination_name(name: str) -> str:
    # "Nashik APMC Mandi" -> "nashik", "Pune Market Yard (Gultekdi)" -> "pune"
    cleaned = re.split(r"\(|\bmandi\b|\bmarket\b|\bapmc\b|\byard\b|\bstorage\b|\bcold\b|\bhub\b|\bchain\b",
                        name, flags=re.I)[0]
    return cleaned.strip().lower()


def get_live_price(crop_type: str, state: str, destination_name: str | None = None) -> dict | None:
    """Real modal (most-common) wholesale price for `crop_type` in `state`
    today, in Rs/kg (Agmarknet reports Rs/quintal; converted here). Tries to
    match `destination_name`'s town against the feed's own market/district
    names first; falls back to a state-wide average across all matching
    mandis for that crop if no town match is found. Returns None if the
    feed has nothing for this crop/state at all -- callers must fall back
    to seeded data in that case, never invent a number."""
    keywords = CROP_COMMODITY_KEYWORDS.get(crop_type, [crop_type])
    records = _fetch_state_records(state)
    matches = [
        r for r in records
        if any(k in (r.get("commodity") or "").lower() for k in keywords)
        and _parse_price(r.get("modal_price")) is not None
    ]
    if not matches:
        return None

    town = _town_from_destination_name(destination_name) if destination_name else ""
    town_matches = [
        r for r in matches
        if town and (town in (r.get("market") or "").lower() or town in (r.get("district") or "").lower())
    ]

    if town_matches:
        chosen = town_matches[0]
        specificity = "MARKET"
    else:
        prices = [_parse_price(r["modal_price"]) for r in matches]
        avg_price = sum(prices) / len(prices)
        chosen = matches[0]
        chosen = {**chosen, "modal_price": avg_price, "market": None}
        specificity = "STATE_AVERAGE"

    price_per_kg = _parse_price(chosen["modal_price"]) / 100.0  # Rs/quintal -> Rs/kg
    return {
        "price_per_kg": round(price_per_kg, 2),
        "specificity": specificity,
        "market_matched": chosen.get("market"),
        "district_matched": chosen.get("district"),
        "arrival_date": chosen.get("arrival_date"),
        "source": "AGMARKNET_DATA_GOV_IN",
        "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
