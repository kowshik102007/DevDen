from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import func, desc, cast, Date
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.request_log import RequestLog
from app.models.provider import Provider
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("/summary")
def get_summary(
    days: int = Query(7, ge=1, le=90),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(RequestLog).filter(
        RequestLog.user_id == user.id,
        RequestLog.created_at >= since,
    )

    total = q.count()
    success = q.filter(RequestLog.status_code == 200).count()
    errors = q.filter(RequestLog.status_code >= 400).count()

    agg = db.query(
        func.sum(RequestLog.total_tokens),
        func.avg(RequestLog.latency_ms),
    ).filter(
        RequestLog.user_id == user.id,
        RequestLog.created_at >= since,
    ).first()

    return {
        "period_days": days,
        "total_requests": total,
        "successful": success,
        "errors": errors,
        "total_tokens": agg[0] or 0,
        "avg_latency_ms": round(agg[1] or 0),
    }


@router.get("/requests-per-day")
def requests_per_day(
    days: int = Query(7, ge=1, le=90),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(
            cast(RequestLog.created_at, Date).label("day"),
            func.count().label("count"),
            func.sum(RequestLog.total_tokens).label("tokens"),
        )
        .filter(RequestLog.user_id == user.id, RequestLog.created_at >= since)
        .group_by("day")
        .order_by("day")
        .all()
    )
    return [{"date": str(r.day), "requests": r.count, "tokens": r.tokens or 0} for r in rows]


@router.get("/by-model")
def by_model(
    days: int = Query(7, ge=1, le=90),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(
            RequestLog.model,
            func.count().label("count"),
            func.sum(RequestLog.total_tokens).label("tokens"),
            func.avg(RequestLog.latency_ms).label("avg_latency"),
        )
        .filter(RequestLog.user_id == user.id, RequestLog.created_at >= since)
        .group_by(RequestLog.model)
        .order_by(desc("count"))
        .all()
    )
    return [
        {"model": r.model, "requests": r.count, "tokens": r.tokens or 0, "avg_latency_ms": round(r.avg_latency or 0)}
        for r in rows
    ]


@router.get("/by-provider")
def by_provider(
    days: int = Query(7, ge=1, le=90),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(
            RequestLog.provider_name,
            func.count().label("count"),
            func.sum(RequestLog.total_tokens).label("tokens"),
            func.avg(RequestLog.latency_ms).label("avg_latency"),
        )
        .filter(RequestLog.user_id == user.id, RequestLog.created_at >= since)
        .group_by(RequestLog.provider_name)
        .order_by(desc("count"))
        .all()
    )
    return [
        {"provider": r.provider_name or "unknown", "requests": r.count, "tokens": r.tokens or 0, "avg_latency_ms": round(r.avg_latency or 0)}
        for r in rows
    ]


@router.get("/recent")
def recent_requests(
    limit: int = Query(50, ge=1, le=200),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(RequestLog)
        .filter(RequestLog.user_id == user.id)
        .order_by(desc(RequestLog.created_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "endpoint": r.endpoint,
            "model": r.model,
            "provider": r.provider_name,
            "status": r.status_code,
            "latency_ms": r.latency_ms,
            "tokens": r.total_tokens,
            "is_stream": r.is_stream,
            "error": r.error,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/provider-health")
def provider_health(
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    providers = (
        db.query(Provider)
        .filter(Provider.user_id == user.id)
        .order_by(Provider.priority, Provider.created_at)
        .all()
    )
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "status": p.status,
            "enabled": p.enabled,
            "last_checked_at": p.last_checked_at.isoformat() if p.last_checked_at else None,
        }
        for p in providers
    ]
