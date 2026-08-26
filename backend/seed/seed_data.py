"""
Seeds the destinations, price_history rows. Run via seed_and_train.py
or `python seed/seed_data.py` with DATABASE_URL pointing at the running
Postgres/PostGIS container.

Idempotent: clears and re-inserts the seeded rows each run rather than
appending duplicates, so it's safe to re-run during a demo.
"""
import datetime
import os
import sys

import numpy as np
from geoalchemy2.elements import WKTElement

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from werkzeug.security import generate_password_hash

from db import SessionLocal, engine  # noqa: E402
from destinations_data import CROP_BASE_PRICES, DESTINATIONS  # noqa: E402
from models import Destination, PriceHistory, User  # noqa: E402

PRICE_HISTORY_DAYS = 30


def _random_walk_prices(base_price: float, days: int, seed: int) -> list:
    rng = np.random.default_rng(seed)
    prices = [base_price]
    for _ in range(days - 1):
        prev = prices[-1]
        step = rng.normal(0, 0.4)
        mean_reversion = 0.05 * (base_price - prev)
        nxt = max(base_price * 0.5, prev + step + mean_reversion)
        prices.append(round(nxt, 2))
    return prices


def seed():
    session = SessionLocal()
    try:
        session.query(PriceHistory).delete()
        session.query(Destination).delete()
        session.commit()

        destinations = []
        for i, d in enumerate(DESTINATIONS):
            dest = Destination(
                name=d["name"],
                type=d["type"],
                location=WKTElement(f"POINT({d['longitude']} {d['latitude']})", srid=4326),
                latitude=d["latitude"],
                longitude=d["longitude"],
                capacity_kg=d["capacity_kg"],
                base_price_per_kg=d["base_price_per_kg"],
                state=d["state"],
                is_synthetic=True,
                available_capacity_kg=d.get("available_capacity_kg"),
                availability_updated_at=datetime.datetime.now(datetime.timezone.utc) if "available_capacity_kg" in d else None,
            )
            session.add(dest)
            destinations.append(dest)
        session.flush()  # assign ids

        today = datetime.date.today()
        seed_counter = 0
        for dest_idx, dest in enumerate(destinations):
            for crop, base_price in CROP_BASE_PRICES.items():
                rng = np.random.default_rng(1000 + dest_idx)
                destination_factor = 0.85 + 0.30 * rng.random()
                dest_base = base_price * destination_factor
                seed_counter += 1
                walk = _random_walk_prices(dest_base, PRICE_HISTORY_DAYS, seed=seed_counter)
                for day_offset, price in enumerate(walk):
                    recorded_date = today - datetime.timedelta(days=(PRICE_HISTORY_DAYS - 1 - day_offset))
                    session.add(PriceHistory(
                        destination_id=dest.id,
                        crop_type=crop,
                        price_per_kg=price,
                        recorded_date=recorded_date,
                    ))

        session.commit()
        
        # Create demo_judge user if it doesn't exist
        demo_user = session.query(User).filter(User.username == "demo_judge").first()
        if not demo_user:
            demo_user = User(
                username="demo_judge",
                password_hash=generate_password_hash("sih2026demo"),
                full_name="SIH Judge"
            )
            session.add(demo_user)
            session.commit()
            print("Seeded demo_judge user.")

        print(f"Seeded {len(destinations)} destinations and "
              f"{len(destinations) * len(CROP_BASE_PRICES) * PRICE_HISTORY_DAYS} price_history rows.")
    finally:
        session.close()


if __name__ == "__main__":
    seed()
