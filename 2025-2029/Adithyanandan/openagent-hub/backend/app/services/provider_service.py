import time
from datetime import datetime
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core import crypto
from app.models.provider import Provider
from app.models.provider_key import ProviderKey
from app.schemas.provider import ProviderCreate, ProviderUpdate, ProviderTestResult
from app.services.provider_presets import find_preset, filter_free_models, filter_free_model_objects


def _models_endpoint(provider: Provider) -> str:
    """Where to GET the model list for this provider.

    Most providers expose `<base>/models`; a few (GitHub Models, Cloudflare)
    list models at a different URL, captured in the preset's `models_url`."""
    preset = find_preset(name=provider.name, base_url=provider.base_url)
    if preset and preset.models_url:
        # Cloudflare's models_url carries the same {ACCOUNT_ID} the user filled
        # into base_url — recover it from the stored base and substitute.
        if preset.needs_template and "{ACCOUNT_ID}" in preset.models_url:
            tmpl_prefix = preset.base_url.split("{ACCOUNT_ID}")[0]
            tmpl_suffix = preset.base_url.split("{ACCOUNT_ID}")[-1].rstrip("/")
            base = provider.base_url.rstrip("/")
            account = base[len(tmpl_prefix):]
            if tmpl_suffix and account.endswith(tmpl_suffix):
                account = account[: -len(tmpl_suffix)]
            return preset.models_url.replace("{ACCOUNT_ID}", account)
        return preset.models_url
    return f"{provider.base_url}/models"


def _parse_model_ids(data) -> list[str]:
    """Extract model ids from the varied JSON shapes providers return."""
    # Top-level list of model objects (e.g. LLM7) or bare id strings.
    if isinstance(data, list):
        out = []
        for m in data:
            if isinstance(m, dict) and (m.get("id") or m.get("name")):
                out.append(m.get("id") or m.get("name"))
            elif isinstance(m, str):
                out.append(m)
        return out
    if not isinstance(data, dict):
        return []
    # OpenAI shape: {"data": [{"id": ...}]}
    if isinstance(data.get("data"), list):
        out = []
        for m in data["data"]:
            if isinstance(m, dict) and m.get("id"):
                out.append(m["id"])
            elif isinstance(m, dict) and m.get("name"):
                out.append(m["name"])
        if out:
            return out
    # GitHub Models catalog / Cloudflare search: {"result"|"models": [{"id"|"name"}]}
    for key in ("result", "models"):
        items = data.get(key)
        if isinstance(items, list):
            out = [m.get("id") or m.get("name") for m in items if isinstance(m, dict)]
            out = [m for m in out if m]
            if out:
                return out
    return []


def _parse_model_objects(data) -> list:
    """Return the raw model objects (dicts) so tier/pricing metadata survives for
    free-tier filtering. Falls back to id strings for shapes we only parse flatly."""
    if isinstance(data, list):
        return [m for m in data if isinstance(m, (dict, str))]
    if not isinstance(data, dict):
        return []
    for key in ("data", "result", "models"):
        items = data.get(key)
        if isinstance(items, list) and items:
            return [m for m in items if isinstance(m, (dict, str))]
    return []


def list_providers(db: Session, user_id: UUID) -> list[Provider]:
    return (
        db.query(Provider)
        .filter(Provider.user_id == user_id)
        .order_by(Provider.priority, Provider.created_at)
        .all()
    )


def get_provider(db: Session, user_id: UUID, provider_id: UUID) -> Provider:
    p = db.query(Provider).filter(Provider.id == provider_id, Provider.user_id == user_id).first()
    if not p:
        raise ValueError("Provider not found")
    return p


def create_provider(db: Session, user_id: UUID, data: ProviderCreate) -> Provider:
    encrypted = crypto.encrypt(data.api_key)
    p = Provider(
        user_id=user_id,
        name=data.name,
        base_url=data.base_url.rstrip("/"),
        api_key=encrypted,
        priority=data.priority,
    )
    db.add(p)
    db.flush()
    pk = ProviderKey(provider_id=p.id, label="default", api_key=encrypted)
    db.add(pk)
    db.commit()
    db.refresh(p)
    return p


def update_provider(db: Session, user_id: UUID, provider_id: UUID, data: ProviderUpdate) -> Provider:
    p = get_provider(db, user_id, provider_id)
    for field, value in data.model_dump(exclude_none=True).items():
        if field == "base_url":
            value = value.rstrip("/")
        elif field == "api_key":
            if "…" in value:
                continue
            value = crypto.encrypt(value)
            default_key = (
                db.query(ProviderKey)
                .filter(ProviderKey.provider_id == p.id, ProviderKey.label == "default")
                .first()
            )
            if default_key:
                default_key.api_key = value
            else:
                db.add(ProviderKey(provider_id=p.id, label="default", api_key=value))
        setattr(p, field, value)
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


def delete_provider(db: Session, user_id: UUID, provider_id: UUID) -> None:
    p = get_provider(db, user_id, provider_id)
    db.delete(p)
    db.commit()


async def test_provider(db: Session, user_id: UUID, provider_id: UUID) -> ProviderTestResult:
    p = get_provider(db, user_id, provider_id)
    start = time.monotonic()
    try:
        key = crypto.decrypt(p.api_key)
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(_models_endpoint(p), headers=headers)
            resp.raise_for_status()
            data = resp.json()
            objects = _parse_model_objects(data)
        # Keep only free models — drops paid/pro tiers (LLM7 tier:pro, pricing>0)
        # and applies the provider's free-name rule (:free, -free, …).
        models = filter_free_model_objects(objects, name=p.name, base_url=p.base_url)
        latency_ms = int((time.monotonic() - start) * 1000)
        p.status = "healthy"
        p.last_checked_at = datetime.utcnow()
        db.commit()
        return ProviderTestResult(status="healthy", latency_ms=latency_ms, models=models)
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        p.status = "error"
        p.last_checked_at = datetime.utcnow()
        db.commit()
        return ProviderTestResult(status="error", latency_ms=latency_ms, models=[], error=str(exc))


async def fetch_provider_models(db: Session, user_id: UUID, provider_id: UUID) -> list[str]:
    p = get_provider(db, user_id, provider_id)
    key = crypto.decrypt(p.api_key)
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(_models_endpoint(p), headers=headers)
        resp.raise_for_status()
        data = resp.json()
        objects = _parse_model_objects(data)
    # Surface only free models (drops paid/pro tiers; no-op for unknown providers).
    return filter_free_model_objects(objects, name=p.name, base_url=p.base_url)


def has_enabled_providers(db: Session, user_id: UUID) -> bool:
    return db.query(Provider).filter(
        Provider.user_id == user_id, Provider.enabled == True
    ).count() > 0
