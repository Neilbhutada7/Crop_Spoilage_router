"""
Batch history for the dashboard view. Lists past harvest batches together
with their most recently computed risk assessment (looked up in Python
rather than a correlated SQL subquery -- batch volumes at demo scale make
that simpler to read without a meaningful cost).
"""
import datetime

from db import SessionLocal
from models import HarvestBatch, RiskAssessment
from services.destination_service import rank_destinations
from services.risk_service import BatchNotFoundError as RiskBatchNotFoundError
from services.risk_service import assess_risk


def list_batches(limit: int = 100) -> list:
    session = SessionLocal()
    try:
        batches = (
            session.query(HarvestBatch)
            .order_by(HarvestBatch.created_at.desc())
            .limit(limit)
            .all()
        )
        batch_ids = [b.id for b in batches]

        latest_by_batch = {}
        if batch_ids:
            assessments = (
                session.query(RiskAssessment)
                .filter(RiskAssessment.batch_id.in_(batch_ids))
                .order_by(RiskAssessment.created_at.desc())
                .all()
            )
            for a in assessments:
                latest_by_batch.setdefault(a.batch_id, a)

        today = datetime.date.today()
        result = []
        for b in batches:
            latest = latest_by_batch.get(b.id)
            result.append({
                "id": b.id,
                "crop_type": b.crop_type,
                "harvest_date": b.harvest_date.isoformat(),
                "quantity_kg": float(b.quantity_kg),
                "farm_latitude": float(b.farm_latitude),
                "farm_longitude": float(b.farm_longitude),
                "days_since_harvest": max((today - b.harvest_date).days, 0),
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "latest_risk_score": float(latest.risk_score) if latest else None,
                "latest_risk_label": latest.risk_label if latest else None,
                "status": b.status,
                "sold_at": b.sold_at.isoformat() if b.sold_at else None,
                "actual_price_per_kg": float(b.actual_price_per_kg) if b.actual_price_per_kg is not None else None,
                "actual_quantity_sold_kg": float(b.actual_quantity_sold_kg) if b.actual_quantity_sold_kg is not None else None,
                "actual_quantity_spoiled_kg": float(b.actual_quantity_spoiled_kg) if b.actual_quantity_spoiled_kg is not None else None,
                "predicted_risk_score": float(b.predicted_risk_score) if b.predicted_risk_score is not None else None,
                "predicted_net_value": float(b.predicted_net_value) if b.predicted_net_value is not None else None,
                "sold_destination_name": b.sold_destination_name,
                # Real profit/loss vs. this same market's own prediction --
                # None unless a real sale (price + quantity) was recorded.
                "actual_net_value": (
                    round(
                        float(b.actual_price_per_kg) * float(b.actual_quantity_sold_kg)
                        - float(b.actual_transport_cost or 0) - float(b.actual_storage_cost or 0),
                        2,
                    )
                    if b.actual_price_per_kg is not None and b.actual_quantity_sold_kg is not None
                    else None
                ),
            })
        return result
    finally:
        session.close()


class BatchNotFoundError(Exception):
    pass


def mark_batch_sold(batch_id: int, actual: dict | None = None) -> dict:
    """Marks a batch sold and, if `actual` outcome data is supplied, records
    it as ground truth alongside a live snapshot of the model's own
    prediction (risk, expected spoilage loss, expected net value at the
    batch's currently top-ranked destination) captured at this same moment
    -- see models.py::HarvestBatch for why the snapshot is taken now rather
    than at harvest time. This is the only place actual outcome data enters
    the system; nothing here is fabricated or backfilled."""
    actual = actual or {}
    has_actual_outcome = any(
        actual.get(f) is not None
        for f in ("actual_price_per_kg", "actual_quantity_sold_kg", "actual_quantity_spoiled_kg")
    )

    # assess_risk()/rank_destinations() each open (and close) their own
    # SessionLocal() -- since SessionLocal is a thread-scoped session, that
    # would tear down an outer session opened before calling them, silently
    # detaching `batch` and losing any attributes set on it afterward. So
    # this snapshot is computed FIRST, entirely before this function opens
    # its own session below.
    predicted_snapshot = {}
    if has_actual_outcome:
        try:
            risk_result = assess_risk(batch_id)
            dest_result = rank_destinations(batch_id)
            destinations = dest_result["destinations"]
            sold_destination_id = actual.get("sold_destination_id")
            # Compare the actual sale against THIS SAME market's own
            # predicted numbers, not always the top-ranked one -- a farmer
            # who sells somewhere other than the #1 recommendation would
            # otherwise be compared against a prediction for a market they
            # never went to, making "you did worse than predicted" readings
            # meaningless. Falls back to the top pick only when no specific
            # destination was recorded for this sale.
            chosen = None
            if sold_destination_id is not None:
                chosen = next((d for d in destinations if d["destination_id"] == sold_destination_id), None)
            if chosen is None:
                chosen = destinations[0] if destinations else None
            predicted_snapshot = {
                "predicted_risk_score": risk_result["risk_score"],
                "predicted_spoilage_loss": chosen["expected_spoilage_loss"] if chosen else None,
                "predicted_net_value": chosen["expected_realised_value"] if chosen else None,
                "prediction_captured_at": datetime.datetime.now(datetime.timezone.utc),
            }
        except RiskBatchNotFoundError:
            raise BatchNotFoundError(f"harvest_batches.id={batch_id} not found")
        except Exception:
            # Prediction snapshot is best-effort context for the actual
            # outcome -- never block recording real ground truth on it.
            pass

    session = SessionLocal()
    try:
        batch = session.get(HarvestBatch, batch_id)
        if batch is None:
            raise BatchNotFoundError(f"harvest_batches.id={batch_id} not found")

        batch.status = "sold"
        batch.sold_at = datetime.datetime.now(datetime.timezone.utc)

        for field in ("actual_price_per_kg", "actual_quantity_sold_kg", "actual_quantity_spoiled_kg",
                      "actual_transport_cost", "actual_storage_cost", "sold_destination_name",
                      "sold_destination_id"):
            if actual.get(field) is not None:
                setattr(batch, field, actual[field])

        for field, value in predicted_snapshot.items():
            setattr(batch, field, value)

        session.commit()
        return {
            "id": batch.id,
            "status": batch.status,
            "sold_at": batch.sold_at.isoformat(),
            "actual_price_per_kg": float(batch.actual_price_per_kg) if batch.actual_price_per_kg is not None else None,
            "actual_quantity_sold_kg": float(batch.actual_quantity_sold_kg) if batch.actual_quantity_sold_kg is not None else None,
            "actual_quantity_spoiled_kg": float(batch.actual_quantity_spoiled_kg) if batch.actual_quantity_spoiled_kg is not None else None,
            "predicted_risk_score": float(batch.predicted_risk_score) if batch.predicted_risk_score is not None else None,
            "predicted_net_value": float(batch.predicted_net_value) if batch.predicted_net_value is not None else None,
        }
    finally:
        session.close()


def get_predicted_vs_actual(batch_id: int) -> dict | None:
    """Returns the frozen prediction-vs-actual comparison for a sold batch,
    or None if no actual outcome has been recorded yet -- callers must show
    an honest "waiting for actual outcome" state in that case, never a
    fabricated comparison."""
    session = SessionLocal()
    try:
        batch = session.get(HarvestBatch, batch_id)
        if batch is None:
            raise BatchNotFoundError(f"harvest_batches.id={batch_id} not found")
        if batch.actual_price_per_kg is None and batch.actual_quantity_sold_kg is None:
            return None

        actual_revenue = None
        if batch.actual_price_per_kg is not None and batch.actual_quantity_sold_kg is not None:
            actual_revenue = float(batch.actual_price_per_kg) * float(batch.actual_quantity_sold_kg)
        actual_costs = float(batch.actual_transport_cost or 0) + float(batch.actual_storage_cost or 0)
        actual_net_value = round(actual_revenue - actual_costs, 2) if actual_revenue is not None else None

        return {
            "batch_id": batch.id,
            "predicted_risk_score": float(batch.predicted_risk_score) if batch.predicted_risk_score is not None else None,
            "predicted_spoilage_loss": float(batch.predicted_spoilage_loss) if batch.predicted_spoilage_loss is not None else None,
            "predicted_net_value": float(batch.predicted_net_value) if batch.predicted_net_value is not None else None,
            "prediction_captured_at": batch.prediction_captured_at.isoformat() if batch.prediction_captured_at else None,
            "actual_price_per_kg": float(batch.actual_price_per_kg) if batch.actual_price_per_kg is not None else None,
            "actual_quantity_sold_kg": float(batch.actual_quantity_sold_kg) if batch.actual_quantity_sold_kg is not None else None,
            "actual_quantity_spoiled_kg": float(batch.actual_quantity_spoiled_kg) if batch.actual_quantity_spoiled_kg is not None else None,
            "actual_transport_cost": float(batch.actual_transport_cost) if batch.actual_transport_cost is not None else None,
            "actual_storage_cost": float(batch.actual_storage_cost) if batch.actual_storage_cost is not None else None,
            "actual_net_value": actual_net_value,
            "sold_destination_name": batch.sold_destination_name,
        }
    finally:
        session.close()
