"""Unified system status API (Phase 12).

Provides a single endpoint for the frontend to display the full health picture:
providers with circuit breaker state, quota gauges, model counts, and failover log.
"""
import os
import platform
import subprocess
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import func, desc, case
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.provider import Provider
from app.models.model_catalog import ModelCatalog
from app.models.request_log import RequestLog
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/system", tags=["system"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("/status")
def system_status(
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    providers = (
        db.query(Provider)
        .filter(Provider.user_id == user.id)
        .order_by(Provider.priority, Provider.created_at)
        .all()
    )

    total_models = db.query(func.count(ModelCatalog.id)).filter(
        ModelCatalog.user_id == user.id, ModelCatalog.is_enabled == True
    ).scalar() or 0

    since_24h = datetime.utcnow() - timedelta(hours=24)
    req_24h = db.query(func.count(RequestLog.id)).filter(
        RequestLog.user_id == user.id, RequestLog.created_at >= since_24h
    ).scalar() or 0
    err_24h = db.query(func.count(RequestLog.id)).filter(
        RequestLog.user_id == user.id, RequestLog.created_at >= since_24h,
        RequestLog.status_code >= 400
    ).scalar() or 0

    provider_statuses = []
    total_rpm_remaining = 0
    total_rpm_limit = 0
    healthy_count = 0
    for p in providers:
        info = {
            "id": str(p.id),
            "name": p.name,
            "enabled": p.enabled,
            "status": p.status,
            "circuit_state": p.circuit_state or "closed",
            "consecutive_failures": p.consecutive_failures or 0,
            "cooldown_until": p.cooldown_until.isoformat() if p.cooldown_until else None,
            "last_error": p.last_error,
            "last_error_at": p.last_error_at.isoformat() if p.last_error_at else None,
            "last_checked_at": p.last_checked_at.isoformat() if p.last_checked_at else None,
            "rpm_remaining": p.rpm_remaining,
            "rpm_limit": p.rpm_limit,
            "tpm_remaining": p.tpm_remaining,
            "tpm_limit": p.tpm_limit,
            "quota_reset_at": p.quota_reset_at.isoformat() if p.quota_reset_at else None,
        }
        provider_statuses.append(info)
        if p.enabled and p.status == "healthy":
            healthy_count += 1
        if p.rpm_remaining is not None:
            total_rpm_remaining += p.rpm_remaining
        if p.rpm_limit is not None:
            total_rpm_limit += p.rpm_limit

    return {
        "providers": provider_statuses,
        "summary": {
            "total_providers": len(providers),
            "healthy_providers": healthy_count,
            "total_models": total_models,
            "requests_24h": req_24h,
            "errors_24h": err_24h,
            "success_rate_24h": round((1 - err_24h / req_24h) * 100, 1) if req_24h > 0 else 100.0,
            "pooled_rpm_remaining": total_rpm_remaining if total_rpm_limit > 0 else None,
            "pooled_rpm_limit": total_rpm_limit if total_rpm_limit > 0 else None,
        },
    }


@router.get("/failover-log")
def failover_log(
    limit: int = Query(50, ge=1, le=200),
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(RequestLog)
        .filter(
            RequestLog.user_id == user.id,
            RequestLog.status_code >= 400,
        )
        .order_by(desc(RequestLog.created_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "model": r.model,
            "provider": r.provider_name,
            "status_code": r.status_code,
            "error": r.error,
            "latency_ms": r.latency_ms,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/open-workspace")
def open_workspace(user=Depends(_current_user)):
    workspace = os.environ.get("WORKSPACE_DIR", os.getcwd())
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.Popen(["open", workspace])
        elif system == "Windows":
            subprocess.Popen(["explorer", workspace])
        else:
            subprocess.Popen(["xdg-open", workspace])
        return {"path": workspace, "opened": True}
    except Exception:
        return {"path": workspace, "opened": False}
