-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE destination_type AS ENUM ('storage_facility', 'mandi');

CREATE TABLE destinations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type destination_type NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL, -- Spatial column
    capacity_kg INT,
    base_price_per_kg DOUBLE PRECISION,
    state VARCHAR(255) NOT NULL,
    is_synthetic BOOLEAN DEFAULT TRUE
);

CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    destination_id INT REFERENCES destinations(id) ON DELETE CASCADE,
    crop_type VARCHAR(50) NOT NULL,
    price_per_kg DOUBLE PRECISION NOT NULL,
    recorded_date DATE NOT NULL
);

CREATE TABLE harvest_batches (
    id SERIAL PRIMARY KEY,
    crop_type VARCHAR(50) NOT NULL,
    harvest_date DATE NOT NULL,
    quantity_kg DOUBLE PRECISION NOT NULL,
    farm_latitude DOUBLE PRECISION NOT NULL,
    farm_longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risk_assessments (
    id SERIAL PRIMARY KEY,
    batch_id INT REFERENCES harvest_batches(id) ON DELETE CASCADE,
    risk_score DOUBLE PRECISION NOT NULL,
    risk_label VARCHAR(50) NOT NULL,
    temperature_c DOUBLE PRECISION NOT NULL,
    humidity_pct DOUBLE PRECISION NOT NULL,
    days_since_harvest INT NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for spatial queries
CREATE INDEX idx_destinations_location ON destinations USING GIST(location);
