"""
Persona Alert REST API
========================
Endpoints for managing persona profiles, alert subscriptions,
delivery history, and on-demand alert preview / trigger.

All endpoints are auth-gated via Depends(get_current_user).

Routes
------
  GET    /api/v1/alerts/profile/me          — get persona profile
  PUT    /api/v1/alerts/profile/me          — update persona profile
  GET    /api/v1/alerts/subscriptions       — list my subscriptions
  POST   /api/v1/alerts/subscriptions       — create subscription
  DELETE /api/v1/alerts/subscriptions/{id} — cancel subscription
  GET    /api/v1/alerts/history             — delivery history (paginated)
  POST   /api/v1/alerts/preview             — generate alert content (no send)
  POST   /api/v1/alerts/trigger             — generate + deliver immediately
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class PersonaProfileUpdate(BaseModel):
    persona: Optional[str]                    = Field(None, description="individual | community | municipality")
    locality: Optional[str]                   = None
    locality_radius_km: Optional[float]       = Field(None, ge=0.1, le=50.0)
    notification_channels: Optional[Dict]     = None
    persona_meta: Optional[Dict]              = None
    alert_threshold_pm25: Optional[float]     = Field(None, ge=10.0, le=500.0)


class SubscriptionCreate(BaseModel):
    trigger: str                              = Field(..., description="threshold_breach | daily_summary | weekly_plan | monthly_report")
    channels: List[str]                       = Field(default_factory=lambda: ["log"])
    trigger_config: Optional[Dict[str, Any]]  = None


class AlertPreviewRequest(BaseModel):
    alert_type: str                           = Field(..., description="See AlertType enum values")
    persona_override: Optional[str]           = None


class AlertTriggerRequest(BaseModel):
    alert_type: str
    channels: Optional[List[str]]             = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _supabase():
    from backend.app.services.supabase import get_supabase
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return sb


def _user_id(user: Dict[str, Any]) -> str:
    return str(user.get("id") or user.get("user_id") or user.get("sub", ""))


# ---------------------------------------------------------------------------
# GET /alerts/profile/me
# ---------------------------------------------------------------------------

@router.get("/profile/me", summary="Get current user's persona profile")
async def get_persona_profile(user: Dict = Depends(get_current_user)) -> Dict:
    sb  = _supabase()
    uid = _user_id(user)
    try:
        res = (
            sb.table("user_profiles")
            .select(
                "id, email, full_name, persona, locality, locality_radius_km, "
                "notification_channels, persona_meta, alert_threshold_pm25, "
                "preferred_language, default_city, home_lat, home_lon, "
                "has_respiratory_condition, user_group"
            )
            .eq("id", uid)
            .single()
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data


# ---------------------------------------------------------------------------
# PUT /alerts/profile/me
# ---------------------------------------------------------------------------

@router.put("/profile/me", summary="Update persona profile settings")
async def update_persona_profile(
    body: PersonaProfileUpdate,
    user: Dict = Depends(get_current_user),
) -> Dict:
    sb  = _supabase()
    uid = _user_id(user)

    updates: Dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate persona value
    if "persona" in updates:
        from backend.app.alerts.personas import Persona
        allowed = {p.value for p in Persona}
        if updates["persona"] not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"persona must be one of: {allowed}",
            )

    try:
        res = (
            sb.table("user_profiles")
            .update(updates)
            .eq("id", uid)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"updated": True, "fields": list(updates.keys())}


# ---------------------------------------------------------------------------
# GET /alerts/subscriptions
# ---------------------------------------------------------------------------

@router.get("/subscriptions", summary="List my alert subscriptions")
async def list_subscriptions(user: Dict = Depends(get_current_user)) -> List[Dict]:
    sb  = _supabase()
    uid = _user_id(user)
    try:
        res = (
            sb.table("alert_subscriptions")
            .select("id, trigger, trigger_config, channels, active, created_at")
            .eq("user_id", uid)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return res.data or []


# ---------------------------------------------------------------------------
# POST /alerts/subscriptions
# ---------------------------------------------------------------------------

@router.post(
    "/subscriptions",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new alert subscription",
)
async def create_subscription(
    body: SubscriptionCreate,
    user: Dict = Depends(get_current_user),
) -> Dict:
    sb  = _supabase()
    uid = _user_id(user)

    valid_triggers = {"threshold_breach", "daily_summary", "weekly_plan", "monthly_report"}
    if body.trigger not in valid_triggers:
        raise HTTPException(
            status_code=422,
            detail=f"trigger must be one of: {valid_triggers}",
        )

    row = {
        "id":             str(uuid4()),
        "user_id":        uid,
        "trigger":        body.trigger,
        "trigger_config": body.trigger_config or {},
        "channels":       body.channels,
        "active":         True,
    }
    try:
        res = sb.table("alert_subscriptions").insert(row).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return res.data[0] if res.data else row


# ---------------------------------------------------------------------------
# DELETE /alerts/subscriptions/{sub_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/subscriptions/{sub_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel an alert subscription",
)
async def delete_subscription(
    sub_id: str,
    user: Dict = Depends(get_current_user),
) -> None:
    sb  = _supabase()
    uid = _user_id(user)
    try:
        # Deactivate rather than hard-delete to preserve audit trail
        sb.table("alert_subscriptions").update({"active": False}).eq("id", sub_id).eq("user_id", uid).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /alerts/history
# ---------------------------------------------------------------------------

@router.get("/history", summary="Paginated alert delivery history")
async def delivery_history(
    page:     int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: Dict = Depends(get_current_user),
) -> Dict:
    sb     = _supabase()
    uid    = _user_id(user)
    offset = (page - 1) * per_page
    try:
        res = (
            sb.table("alert_deliveries")
            .select(
                "id, persona, alert_type, channel, subject, locality, city, "
                "pm25_at_send, severity, status, sent_at"
            )
            .eq("user_id", uid)
            .order("sent_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"page": page, "per_page": per_page, "items": res.data or []}


# ---------------------------------------------------------------------------
# POST /alerts/preview  — generate content, do NOT deliver
# ---------------------------------------------------------------------------

@router.post("/preview", summary="Preview an alert (LLM generation, no delivery)")
async def preview_alert(
    body: AlertPreviewRequest,
    user: Dict = Depends(get_current_user),
) -> Dict:
    from backend.app.alerts.personas import build_context, Persona
    from backend.app.alerts.generators import AlertType, generate_alert

    uid = _user_id(user)

    # Validate alert_type
    try:
        alert_type = AlertType(body.alert_type)
    except ValueError:
        valid = [a.value for a in AlertType]
        raise HTTPException(status_code=422, detail=f"alert_type must be one of: {valid}")

    ctx = await build_context(uid)
    if not ctx:
        raise HTTPException(status_code=404, detail="Could not build persona context — check your profile settings")

    # Allow override for testing
    if body.persona_override:
        try:
            ctx.persona = Persona(body.persona_override)
        except ValueError:
            pass

    try:
        content_md = generate_alert(ctx, alert_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Preview generation failed: %s", e)
        raise HTTPException(status_code=500, detail="Alert generation failed — check LLM configuration")

    return {
        "persona":     ctx.persona.value,
        "alert_type":  alert_type.value,
        "locality":    ctx.locality,
        "city":        ctx.city,
        "pm25":        ctx.stats.avg_pm25,
        "severity":    ctx.stats.severity,
        "content_md":  content_md,
    }


# ---------------------------------------------------------------------------
# POST /alerts/trigger  — generate + deliver immediately
# ---------------------------------------------------------------------------

@router.post("/trigger", summary="Manually trigger and deliver an alert")
async def trigger_alert(
    body: AlertTriggerRequest,
    user: Dict = Depends(get_current_user),
) -> Dict:
    from backend.app.alerts.personas import build_context
    from backend.app.alerts.generators import AlertType, generate_alert
    from backend.app.alerts.delivery import deliver_alert

    uid = _user_id(user)

    try:
        alert_type = AlertType(body.alert_type)
    except ValueError:
        valid = [a.value for a in AlertType]
        raise HTTPException(status_code=422, detail=f"alert_type must be one of: {valid}")

    ctx = await build_context(uid)
    if not ctx:
        raise HTTPException(status_code=404, detail="Could not build persona context")

    try:
        content_md = generate_alert(ctx, alert_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alert generation failed: {e}")

    # Resolve channels: use request channels or fall back to user profile channels
    sb = _supabase()
    try:
        profile_res = (
            sb.table("user_profiles")
            .select("notification_channels, email, phone")
            .eq("id", uid)
            .single()
            .execute()
        )
        profile = profile_res.data or {}
    except Exception:
        profile = {}

    if body.channels:
        channels = list({"log", *body.channels})
    else:
        stored = profile.get("notification_channels") or {}
        channels = ["log"]
        if isinstance(stored, dict):
            channels += [c for c, on in stored.items() if on]
        elif isinstance(stored, list):
            channels += stored

    results = await deliver_alert(
        ctx=ctx,
        alert_type=alert_type,
        content_md=content_md,
        channels=channels,
        to_email=profile.get("email"),
        to_phone=profile.get("phone"),
    )

    return {
        "persona":    ctx.persona.value,
        "alert_type": alert_type.value,
        "locality":   ctx.locality,
        "channels":   results,
        "content_md": content_md,
    }
