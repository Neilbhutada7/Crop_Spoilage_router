-- Spoilage Router schema
-- Runs automatically on first container start (mounted into
-- /docker-entrypoint-initdb.d/ of the postgis/postgis image).

CREATE EXTENSION IF NOT EXISTS postgis;

DO $$ BEGIN
    CREATE TYPE destination_type AS ENUM ('storage_facility', 'mandi');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE crop_type_enum AS ENUM ('tomato', 'onion', 'banana', 'potato', 'mango', 'chili');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_label_enum AS ENUM ('Low', 'Medium', 'High');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS destinations (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    type                destination_type NOT NULL,
    -- geography column drives the spatial (ST_Distance / nearest-neighbor) queries;
    -- latitude/longitude are kept alongside it so the API can return plain floats
    -- without unpacking geometry on every request.
    location            geography(Point, 4326) NOT NULL,
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    capacity_kg         NUMERIC NOT NULL,
    base_price_per_kg   NUMERIC NOT NULL,
    state               TEXT NOT NULL,
    is_synthetic        BOOLEAN NOT NULL DEFAULT TRUE,
    -- Space currently free at this facility (storage_facility rows only;
    -- NULL for mandis, which don't have a capacity concept). Not a live
    -- feed -- see availability_source, always surfaced to the frontend as
    -- DEMO_AVAILABILITY so it's never shown as real-time occupancy.
    available_capacity_kg    NUMERIC,
    availability_updated_at  TIMESTAMPTZ,
    availability_source      TEXT NOT NULL DEFAULT 'DEMO_AVAILABILITY'
);

CREATE INDEX IF NOT EXISTS idx_destinations_location
    ON destinations USING GIST (location);

CREATE TABLE IF NOT EXISTS price_history (
    id              SERIAL PRIMARY KEY,
    destination_id  INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    crop_type       crop_type_enum NOT NULL,
    price_per_kg    NUMERIC NOT NULL,
    recorded_date   DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_dest_crop_date
    ON price_history (destination_id, crop_type, recorded_date);

CREATE TABLE IF NOT EXISTS harvest_batches (
    id              SERIAL PRIMARY KEY,
    crop_type       crop_type_enum NOT NULL,
    harvest_date    DATE NOT NULL,
    quantity_kg     NUMERIC NOT NULL CHECK (quantity_kg > 0),
    farm_latitude   DOUBLE PRECISION NOT NULL,
    farm_longitude  DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          VARCHAR NOT NULL DEFAULT 'active',
    sold_at         TIMESTAMPTZ,
    -- Ground truth recorded by the farmer after the batch is actually sold
    -- (see services/batch_history_service.py::mark_batch_sold) -- everything
    -- else in this app is a prediction; these columns are the only real
    -- outcome data, and are what the Predicted-vs-Actual view compares against.
    actual_price_per_kg          NUMERIC,
    actual_quantity_sold_kg      NUMERIC,
    actual_quantity_spoiled_kg   NUMERIC,
    actual_transport_cost        NUMERIC,
    actual_storage_cost          NUMERIC,
    sold_destination_name        TEXT,
    sold_destination_id          INTEGER REFERENCES destinations(id) ON DELETE SET NULL,
    -- Model's own prediction, captured at the moment the actual sale is
    -- recorded (not at harvest time -- this app doesn't snapshot a
    -- prediction until there's a real outcome to compare it against). This
    -- is what Predicted-vs-Actual compares the actual_* columns to.
    predicted_risk_score          NUMERIC,
    predicted_spoilage_loss       NUMERIC,
    predicted_net_value           NUMERIC,
    prediction_captured_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS risk_assessments (
    id                  SERIAL PRIMARY KEY,
    batch_id            INTEGER NOT NULL REFERENCES harvest_batches(id) ON DELETE CASCADE,
    risk_score          NUMERIC NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_label          risk_label_enum NOT NULL,
    temperature_c       DOUBLE PRECISION NOT NULL,
    humidity_pct        DOUBLE PRECISION NOT NULL,
    days_since_harvest  INTEGER NOT NULL,
    model_version       TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail for NotificationService.send_alert (see
-- backend/services/notification_service.py) -- persisted alongside the
-- stub console/file log so the frontend has something queryable to show.
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    batch_id    INTEGER NOT NULL REFERENCES harvest_batches(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
