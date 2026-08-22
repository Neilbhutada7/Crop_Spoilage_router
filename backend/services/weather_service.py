"""
Weather lookups for a farm location/date.

Uses Open-Meteo (https://open-meteo.com) -- no API key required, blends
multiple national forecast models (ECMWF, NOAA GFS, DWD ICON) rather than
a single provider, and covers current conditions, a 16-day forecast, and
a historical archive (ERA5 reanalysis) for past dates. Falls back to a
clearly-labeled synthetic weather generator only if Open-Meteo is
unreachable or the date falls outside what it can serve.
"""
import datetime
import hashlib
import sys

import requests

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

HOURLY_FIELDS = "temperature_2m,relative_humidity_2m,wind_speed_10m"


def _seasonal_synthetic_weather(lat: float, lon: float, target_date: datetime.date) -> dict:
    """Deterministic-per-input synthetic generator, seasoned roughly for
    Maharashtra's climate calendar. Clearly flagged as synthetic in the
    return value -- never presented to the UI as real data."""
    month = target_date.month
    if month in (3, 4, 5):          # summer
        temp_range, humidity_range, wind_range = (30, 42), (25, 45), (6, 16)
    elif month in (6, 7, 8, 9):     # monsoon
        temp_range, humidity_range, wind_range = (24, 30), (70, 95), (14, 32)
    elif month in (10, 11):         # post-monsoon
        temp_range, humidity_range, wind_range = (22, 32), (45, 70), (5, 14)
    else:                            # winter (12, 1, 2)
        temp_range, humidity_range, wind_range = (14, 26), (30, 55), (3, 10)

    seed_input = f"{round(lat, 3)},{round(lon, 3)},{target_date.isoformat()}"
    digest = hashlib.sha256(seed_input.encode()).hexdigest()
    frac_temp = int(digest[:8], 16) / 0xFFFFFFFF
    frac_hum = int(digest[8:16], 16) / 0xFFFFFFFF
    frac_wind = int(digest[16:24], 16) / 0xFFFFFFFF

    temperature_c = round(temp_range[0] + frac_temp * (temp_range[1] - temp_range[0]), 1)
    humidity_pct = round(humidity_range[0] + frac_hum * (humidity_range[1] - humidity_range[0]), 1)
    wind_speed_kmh = round(wind_range[0] + frac_wind * (wind_range[1] - wind_range[0]), 1)

    return {
        "temperature_c": temperature_c,
        "humidity_pct": humidity_pct,
        "wind_speed_kmh": wind_speed_kmh,
        "source": "synthetic",
        "is_synthetic": True,
        "note": "Synthetic weather (seasonal model for Maharashtra) -- Open-Meteo was unreachable or the date is outside its coverage.",
    }


def _closest_to_midday(hourly: dict, target_date: datetime.date):
    """Open-Meteo returns parallel arrays keyed by ISO timestamp strings
    in `hourly["time"]`. Pick the hour on target_date closest to midday."""
    best_idx, best_delta = None, None
    for i, ts in enumerate(hourly.get("time", [])):
        dt = datetime.datetime.fromisoformat(ts)
        if dt.date() != target_date:
            continue
        delta = abs(dt.hour - 12)
        if best_delta is None or delta < best_delta:
            best_idx, best_delta = i, delta
    return best_idx


def _fetch_real_weather(lat: float, lon: float, target_date: datetime.date):
    """Returns a real-data dict on success, or None if the date is outside
    what Open-Meteo's endpoints can serve or the request fails."""
    today = datetime.date.today()
    days_diff = (target_date - today).days

    try:
        if days_diff == 0:
            resp = requests.get(
                FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": HOURLY_FIELDS,
                    "timezone": "auto",
                },
                timeout=6,
            )
            resp.raise_for_status()
            current = resp.json()["current"]
            return {
                "temperature_c": round(current["temperature_2m"], 1),
                "humidity_pct": round(current["relative_humidity_2m"], 1),
                "wind_speed_kmh": round(current["wind_speed_10m"], 1),
                "source": "open-meteo",
                "is_synthetic": False,
                "note": "Live Open-Meteo current conditions.",
            }

        if 0 < days_diff <= 15:
            resp = requests.get(
                FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": HOURLY_FIELDS,
                    # forecast_days=N covers today..today+(N-1); Open-Meteo caps
                    # N at 16, so day offsets beyond 15 can't be requested this way.
                    "forecast_days": days_diff + 1,
                    "timezone": "auto",
                },
                timeout=6,
            )
            resp.raise_for_status()
            hourly = resp.json()["hourly"]
            idx = _closest_to_midday(hourly, target_date)
            if idx is None:
                return None
            return {
                "temperature_c": round(hourly["temperature_2m"][idx], 1),
                "humidity_pct": round(hourly["relative_humidity_2m"][idx], 1),
                "wind_speed_kmh": round(hourly["wind_speed_10m"][idx], 1),
                "source": "open-meteo",
                "is_synthetic": False,
                "note": "Open-Meteo forecast (midday reading).",
            }

        if -92 <= days_diff < 0:
            resp = requests.get(
                ARCHIVE_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "start_date": target_date.isoformat(),
                    "end_date": target_date.isoformat(),
                    "hourly": HOURLY_FIELDS,
                    "timezone": "auto",
                },
                timeout=6,
            )
            resp.raise_for_status()
            hourly = resp.json()["hourly"]
            idx = _closest_to_midday(hourly, target_date)
            if idx is None:
                return None
            return {
                "temperature_c": round(hourly["temperature_2m"][idx], 1),
                "humidity_pct": round(hourly["relative_humidity_2m"][idx], 1),
                "wind_speed_kmh": round(hourly["wind_speed_10m"][idx], 1),
                "source": "open-meteo",
                "is_synthetic": False,
                "note": "Open-Meteo historical archive (ERA5 reanalysis, midday reading).",
            }
    except (requests.RequestException, KeyError, ValueError) as exc:
        print(f"[weather_service] Open-Meteo request failed, falling back to synthetic: {exc}", file=sys.stderr)
        return None

    return None  # outside the ~92-days-back / 16-days-forward window Open-Meteo can serve


def get_weather(lat: float, lon: float, target_date: datetime.date) -> dict:
    real = _fetch_real_weather(lat, lon, target_date)
    if real is not None:
        return real
    return _seasonal_synthetic_weather(lat, lon, target_date)


def get_weather_series(lat: float, lon: float, start_date: datetime.date, num_days: int) -> dict:
    """Weather for `num_days` consecutive dates starting at `start_date`, as
    {date.isoformat(): weather_dict}. Unlike calling get_weather() in a loop
    (one Open-Meteo request per day -- fine for a 5-day widget, much too
    slow for a 45-day shelf-life projection), this makes AT MOST ONE real
    forecast request covering the whole range Open-Meteo can serve, then
    slices it locally; only dates outside that window fall back to the
    (local, no-network) synthetic generator."""
    out = {}
    end_date = start_date + datetime.timedelta(days=num_days - 1)
    today = datetime.date.today()
    last_real_day_offset = (end_date - today).days

    hourly = None
    if last_real_day_offset >= 0:
        try:
            resp = requests.get(
                FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": HOURLY_FIELDS,
                    # forecast_days=N covers today..today+(N-1); Open-Meteo caps
                    # N at 16, so this can reach at most today+15.
                    "forecast_days": min(last_real_day_offset, 15) + 1,
                    "timezone": "auto",
                },
                timeout=6,
            )
            resp.raise_for_status()
            hourly = resp.json()["hourly"]
        except (requests.RequestException, KeyError, ValueError) as exc:
            print(f"[weather_service] Open-Meteo range request failed, falling back to synthetic: {exc}", file=sys.stderr)
            hourly = None

    for offset in range(num_days):
        d = start_date + datetime.timedelta(days=offset)
        days_diff = (d - today).days
        real = None
        if hourly is not None and 0 <= days_diff <= 15:
            idx = _closest_to_midday(hourly, d)
            if idx is not None:
                real = {
                    "temperature_c": round(hourly["temperature_2m"][idx], 1),
                    "humidity_pct": round(hourly["relative_humidity_2m"][idx], 1),
                    "wind_speed_kmh": round(hourly["wind_speed_10m"][idx], 1),
                    "source": "open-meteo",
                    "is_synthetic": False,
                    "note": "Open-Meteo forecast (midday reading).",
                }
        out[d.isoformat()] = real if real is not None else _seasonal_synthetic_weather(lat, lon, d)
    return out


def get_daily_forecast(lat: float, lon: float, days: int = 5) -> list:
    """Today + (days-1) more days of weather for a location -- used by the
    dashboard's weather widget. Just get_weather() called per day; Open-Meteo
    forecast requests are cheap and this keeps the single-day function as the
    one source of truth for the real/synthetic fallback logic."""
    today = datetime.date.today()
    out = []
    for offset in range(days):
        d = today + datetime.timedelta(days=offset)
        weather = get_weather(lat, lon, d)
        out.append({"date": d.isoformat(), **weather})
    return out
