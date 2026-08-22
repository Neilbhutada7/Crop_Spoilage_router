"""SQLAlchemy ORM models mapped onto the tables created by
backend/db/init.sql. Tables/enum types are created by that SQL script
(run by Postgres on first container start), not by SQLAlchemy metadata,
so enum columns are declared with create_type=False.
"""
from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

destination_type_enum = ENUM(
    "storage_facility", "mandi", name="destination_type", create_type=False
)
crop_type_enum = ENUM(
    "tomato", "onion", "banana", "potato", "mango", "chili",
    name="crop_type_enum", create_type=False
)
risk_label_enum = ENUM(
    "Low", "Medium", "High", name="risk_label_enum", create_type=False
)


class Destination(Base):
    __tablename__ = "destinations"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(destination_type_enum, nullable=False)
    location = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    latitude = Column(Numeric, nullable=False)
    longitude = Column(Numeric, nullable=False)
    capacity_kg = Column(Numeric, nullable=False)
    base_price_per_kg = Column(Numeric, nullable=False)
    state = Column(String, nullable=False)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    available_capacity_kg = Column(Numeric, nullable=True)
    availability_updated_at = Column(DateTime(timezone=True), nullable=True)
    availability_source = Column(String, nullable=False, server_default="DEMO_AVAILABILITY")

    price_history = relationship("PriceHistory", back_populates="destination")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True)
    destination_id = Column(Integer, ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    crop_type = Column(crop_type_enum, nullable=False)
    price_per_kg = Column(Numeric, nullable=False)
    recorded_date = Column(Date, nullable=False)

    destination = relationship("Destination", back_populates="price_history")


class HarvestBatch(Base):
    __tablename__ = "harvest_batches"

    id = Column(Integer, primary_key=True)
    crop_type = Column(crop_type_enum, nullable=False)
    harvest_date = Column(Date, nullable=False)
    quantity_kg = Column(Numeric, nullable=False)
    farm_latitude = Column(Numeric, nullable=False)
    farm_longitude = Column(Numeric, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False, server_default="active")  # "active" | "sold"
    sold_at = Column(DateTime(timezone=True), nullable=True)
    # Ground truth recorded by the farmer after the actual sale -- see
    # services/batch_history_service.py::mark_batch_sold. Everything else
    # in this app is a prediction; these are the only real outcome numbers.
    actual_price_per_kg = Column(Numeric, nullable=True)
    actual_quantity_sold_kg = Column(Numeric, nullable=True)
    actual_quantity_spoiled_kg = Column(Numeric, nullable=True)
    actual_transport_cost = Column(Numeric, nullable=True)
    actual_storage_cost = Column(Numeric, nullable=True)
    sold_destination_name = Column(String, nullable=True)
    sold_destination_id = Column(Integer, ForeignKey("destinations.id", ondelete="SET NULL"), nullable=True)
    predicted_risk_score = Column(Numeric, nullable=True)
    predicted_spoilage_loss = Column(Numeric, nullable=True)
    predicted_net_value = Column(Numeric, nullable=True)
    prediction_captured_at = Column(DateTime(timezone=True), nullable=True)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("harvest_batches.id", ondelete="CASCADE"), nullable=False)
    risk_score = Column(Numeric, nullable=False)
    risk_label = Column(risk_label_enum, nullable=False)
    temperature_c = Column(Numeric, nullable=False)
    humidity_pct = Column(Numeric, nullable=False)
    days_since_harvest = Column(Integer, nullable=False)
    model_version = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("harvest_batches.id", ondelete="CASCADE"), nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
