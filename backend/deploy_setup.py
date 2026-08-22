"""
One-time setup for a freshly-created hosted Postgres database (e.g. a new
Render Postgres instance) -- creates the schema (tables, enum types, the
PostGIS extension) and seeds destinations/price history. NOT run
automatically by the web service on every boot: DDL and seeding on every
restart is the kind of thing that quietly corrupts a database you're
sharing with real data over time. Run this once, manually, right after
the database is first created:

    python deploy_setup.py

Safe to re-run: init.sql's statements are all IF NOT EXISTS / exception-
guarded, and seed_data.seed() clears and re-inserts its own rows rather
than appending duplicates -- but it will NOT touch or delete real
harvest_batches / users / risk_assessments data.

The trained model artifact (model_artifacts/model.pkl, model_meta.json)
is already committed to the repo -- this script does not train anything,
only prepares the database the app.py process will connect to.
"""
import os
import sys

from sqlalchemy import text

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _BACKEND_DIR)
# seed_data.py imports its sibling destinations_data.py as a bare module
# (`from destinations_data import ...`), which only resolves when seed/ is
# itself on sys.path -- true when run directly as `python seed/seed_data.py`,
# not when imported as a package from here.
sys.path.insert(0, os.path.join(_BACKEND_DIR, "seed"))

from db import engine  # noqa: E402
from seed_data import seed  # noqa: E402


def run_schema():
    # PostGIS needs its own attempt, separated from the rest of the schema:
    # some hosted Postgres users aren't granted CREATE EXTENSION rights by
    # default (confirmed locally -- a non-superuser role hits exactly this),
    # and that failure should give a clear, actionable message instead of a
    # scary traceback pointing at unrelated SQL further down the file.
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    except Exception as exc:
        print(
            "Could not create the PostGIS extension automatically "
            f"({exc}). On Render, enable it from your database's "
            "dashboard -> Extensions tab (search 'postgis'), or ask "
            "your hosting provider to enable it, then re-run this script."
        )
        raise

    init_sql_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "init.sql")
    with open(init_sql_path, encoding="utf-8") as f:
        sql = f.read()
    with engine.begin() as conn:
        conn.execute(text(sql))
    print("Schema ready (tables, enum types, PostGIS extension).")


if __name__ == "__main__":
    print(f"Connecting to: {os.environ.get('DATABASE_URL', '(not set -- check your .env / Render env vars)')}")
    run_schema()
    seed()
    print("Done. Destinations and price history seeded.")
