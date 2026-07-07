"""Aggregates request_logs into per-model reliability scores."""
from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.model_catalog import ModelCatalog
from app.models.request_log import RequestLog


def refresh_reliability_stats(db: Session, user_id: UUID, days: int = 7) -> int:
    """Aggregate request_logs from the last `days` days into catalog reliability fields.
    Returns count of catalog entries updated."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    stats = (
        db.query(
            RequestLog.model,
            func.count(RequestLog.id).label("total"),
            func.count(case((RequestLog.status_code < 400, 1))).label("success"),
            func.avg(
                case((RequestLog.status_code < 400, RequestLog.latency_ms))
            ).label("avg_latency"),
        )
        .filter(
            RequestLog.user_id == user_id,
            RequestLog.created_at >= cutoff,
            RequestLog.model.isnot(None),
        )
        .group_by(RequestLog.model)
        .all()
    )

    if not stats:
        return 0

    now = datetime.utcnow()
    count = 0
    for row in stats:
        model_id = row.model
        total = row.total
        success = row.success
        avg_lat = int(row.avg_latency) if row.avg_latency else None
        error_rate = round(1 - (success / total), 3) if total > 0 else None

        if total >= 3:
            reliability = min(10, max(1, int(10 * (success / total))))
        elif total > 0:
            reliability = min(10, max(1, int(8 * (success / total))))
        else:
            reliability = None

        updated = (
            db.query(ModelCatalog)
            .filter(
                ModelCatalog.user_id == user_id,
                ModelCatalog.model_id == model_id,
            )
            .update({
                ModelCatalog.reliability_score: reliability,
                ModelCatalog.avg_latency_ms: avg_lat,
                ModelCatalog.error_rate: error_rate,
                ModelCatalog.last_stats_at: now,
            })
        )
        count += updated

    db.commit()
    return count
