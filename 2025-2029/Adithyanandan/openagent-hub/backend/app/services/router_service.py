"""Provider routing with circuit breaker, exponential backoff, and error classification.

Phase 11: Automatic Failover — zero-downtime AI access.

Circuit breaker states:
  closed   — normal operation, requests flow through
  open     — provider is failing, skip it until cooldown expires
  half_open ��� cooldown expired, allow one probe request to test recovery

Error classification:
  retryable     — 429, 502, 503, 504, timeouts → failover to next provider
  non_retryable — 400, 401, 403, 404 → surface error immediately (bad request / auth)
"""
from datetime import datetime, timedelta
from typing import AsyncIterator
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.models.provider import Provider
from app.core import crypto
from app.core.provider import stream_chat, chat_completion
from app.services import key_service

FAILURE_THRESHOLD = 3
BASE_COOLDOWN_SECONDS = 60
MAX_COOLDOWN_SECONDS = 600
RETRYABLE_STATUS_CODES = {408, 413, 429, 500, 502, 503, 504}


def _is_retryable_status(status_code: int) -> bool:
    return status_code in RETRYABLE_STATUS_CODES


def _is_retryable_error(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return _is_retryable_status(exc.response.status_code)
    if isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError)):
        return True
    return False


def _cooldown_seconds(consecutive_failures: int) -> int:
    secs = BASE_COOLDOWN_SECONDS * (2 ** min(consecutive_failures - 1, 4))
    return min(secs, MAX_COOLDOWN_SECONDS)


def _is_circuit_open(provider: Provider) -> bool:
    if provider.circuit_state == "closed":
        return False
    if provider.circuit_state == "open":
        if provider.cooldown_until and datetime.utcnow() >= provider.cooldown_until:
            provider.circuit_state = "half_open"
            return False
        return True
    return False


def _record_success(db: Session, provider: Provider) -> None:
    provider.consecutive_failures = 0
    provider.circuit_state = "closed"
    provider.cooldown_until = None
    provider.status = "healthy"
    db.add(provider)
    db.commit()


NON_FAULT_STATUS_CODES = {400, 401, 403, 404, 408, 413}

def _record_failure(db: Session, provider: Provider, error: str, status_code: int | None = None) -> None:
    if status_code in NON_FAULT_STATUS_CODES:
        db.add(provider)
        db.commit()
        return

    provider.consecutive_failures = (provider.consecutive_failures or 0) + 1
    provider.last_error = error[:500] if error else None
    provider.last_error_at = datetime.utcnow()

    if status_code == 429:
        provider.status = "rate_limited"
    else:
        provider.status = "error"

    if provider.consecutive_failures >= FAILURE_THRESHOLD:
        provider.circuit_state = "open"
        cooldown = _cooldown_seconds(provider.consecutive_failures)
        provider.cooldown_until = datetime.utcnow() + timedelta(seconds=cooldown)
    db.add(provider)
    db.commit()


def _update_quota(db: Session, provider: Provider, response_headers: dict) -> None:
    def _int(name: str) -> int | None:
        val = response_headers.get(name)
        if val is not None:
            try:
                return int(val)
            except (ValueError, TypeError):
                pass
        return None

    rpm_limit = _int("x-ratelimit-limit-requests")
    tpm_limit = _int("x-ratelimit-limit-tokens")
    rpm_remaining = _int("x-ratelimit-remaining-requests")
    tpm_remaining = _int("x-ratelimit-remaining-tokens")

    if rpm_limit is not None:
        provider.rpm_limit = rpm_limit
    if tpm_limit is not None:
        provider.tpm_limit = tpm_limit
    if rpm_remaining is not None:
        provider.rpm_remaining = rpm_remaining
    if tpm_remaining is not None:
        provider.tpm_remaining = tpm_remaining

    reset_str = response_headers.get("x-ratelimit-reset-requests")
    if reset_str:
        from app.services.key_service import _parse_duration
        secs = _parse_duration(reset_str)
        if secs:
            provider.quota_reset_at = datetime.utcnow() + timedelta(seconds=secs)

    db.add(provider)
    db.commit()


def _resolve_attempts(
    db: Session,
    user_id: UUID,
    model: str,
    preferred_provider_id: str | None,
    model_order: list[tuple[str, str]] | None,
) -> list[tuple[str, "Provider"]]:
    by_id: dict[str, Provider] = {
        str(p.id): p
        for p in db.query(Provider)
        .filter(Provider.user_id == user_id, Provider.enabled == True)
        .all()
    }
    if model_order:
        attempts: list[tuple[str, Provider]] = []
        for mid, pid in model_order:
            prov = by_id.get(str(pid))
            if prov is not None:
                attempts.append((mid, prov))
        if attempts:
            return attempts

    providers = _ordered_providers(db, user_id, preferred_provider_id)

    from app.models.model_catalog import ModelCatalog
    owners = {
        str(r.provider_id)
        for r in db.query(ModelCatalog.provider_id)
        .filter(ModelCatalog.user_id == user_id, ModelCatalog.model_id == model)
        .all()
    }
    if owners:
        scoped = [p for p in providers if str(p.id) in owners]
        if scoped:
            return [(model, p) for p in scoped]
    if preferred_provider_id:
        return [(model, p) for p in providers if str(p.id) == preferred_provider_id]
    return [(model, p) for p in providers]


def _filter_vision(db: Session, user_id: UUID, attempts: list[tuple[str, "Provider"]]) -> list[tuple[str, "Provider"]]:
    from app.models.model_catalog import ModelCatalog
    vision_models = {
        r.model_id
        for r in db.query(ModelCatalog.model_id)
        .filter(ModelCatalog.user_id == user_id, ModelCatalog.vision_support == True)
        .all()
    }
    filtered = [(m, p) for m, p in attempts if m in vision_models]
    return filtered if filtered else attempts


async def route_chat(
    db: Session,
    user_id: UUID,
    model: str,
    messages: list[dict],
    preferred_provider_id: str | None = None,
    model_order: list[tuple[str, str]] | None = None,
    has_image: bool = False,
) -> AsyncIterator[str]:
    attempts = _resolve_attempts(db, user_id, model, preferred_provider_id, model_order)
    if has_image:
        attempts = _filter_vision(db, user_id, attempts)

    if not attempts:
        raise RuntimeError("No enabled providers configured.")

    last_error = "All providers failed."
    for attempt_model, provider in attempts:
        if _is_circuit_open(provider):
            continue
        pk = key_service.pick_key(db, provider)
        api_key = key_service.decrypt_key(pk) if pk else crypto.decrypt(provider.api_key)
        yielded_any = False
        try:
            async for chunk in stream_chat(
                base_url=provider.base_url,
                api_key=api_key,
                model=attempt_model,
                messages=messages,
            ):
                yielded_any = True
                yield chunk
            _record_success(db, provider)
            if pk:
                key_service.record_usage(db, pk)
            return
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            try:
                body_text = exc.response.text[:300] if exc.response.is_stream_consumed or not exc.response.is_closed else str(exc)[:300]
            except Exception:
                body_text = str(exc)[:300]
            error_msg = f"Provider '{provider.name}' HTTP {status}: {body_text}"

            if status == 429 and pk:
                key_service.set_cooldown(db, pk)
            elif pk:
                key_service.set_error(db, pk, f"HTTP {status}")

            _record_failure(db, provider, error_msg, status)
            if yielded_any:
                return
            last_error = error_msg
        except Exception as exc:
            error_msg = f"Provider '{provider.name}' error: {exc}"
            if pk:
                key_service.set_error(db, pk, str(exc))
            _record_failure(db, provider, error_msg)
            if yielded_any:
                return
            last_error = error_msg

    raise RuntimeError(last_error)


def _ordered_providers(
    db: Session, user_id: UUID, preferred_provider_id: str | None
) -> list[Provider]:
    providers: list[Provider] = (
        db.query(Provider)
        .filter(Provider.user_id == user_id, Provider.enabled == True)
        .order_by(Provider.priority, Provider.created_at)
        .all()
    )

    def _sort_key(p: Provider):
        is_preferred = 0 if (preferred_provider_id and str(p.id) == preferred_provider_id) else 1
        is_healthy = 0 if p.circuit_state in (None, "closed", "half_open") else 1
        return (is_preferred, is_healthy, p.priority or 0)

    providers.sort(key=_sort_key)
    return providers


async def route_completion(
    db: Session,
    user_id: UUID,
    model: str,
    messages: list[dict],
    tools: list[dict] | None = None,
    preferred_provider_id: str | None = None,
    temperature: float = 0.4,
    tool_choice: str = "auto",
    model_order: list[tuple[str, str]] | None = None,
) -> tuple[dict, Provider]:
    attempts = _resolve_attempts(db, user_id, model, preferred_provider_id, model_order)
    if not attempts:
        raise RuntimeError("No enabled providers configured.")

    last_error = "All providers failed."
    for attempt_model, provider in attempts:
        if _is_circuit_open(provider):
            continue
        pk = key_service.pick_key(db, provider)
        api_key = key_service.decrypt_key(pk) if pk else crypto.decrypt(provider.api_key)
        try:
            message = await chat_completion(
                base_url=provider.base_url,
                api_key=api_key,
                model=attempt_model,
                messages=messages,
                tools=tools,
                temperature=temperature,
                tool_choice=tool_choice,
            )
            _record_success(db, provider)
            if pk:
                key_service.record_usage(db, pk)
            return message, provider
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            try:
                body_text = exc.response.text[:300] if exc.response.is_stream_consumed or not exc.response.is_closed else str(exc)[:300]
            except Exception:
                body_text = str(exc)[:300]
            error_msg = f"Provider '{provider.name}' HTTP {status}: {body_text}"

            if status == 429 and pk:
                key_service.set_cooldown(db, pk)
            elif pk:
                key_service.set_error(db, pk, f"HTTP {status}")

            _record_failure(db, provider, error_msg, status)
            last_error = error_msg
        except Exception as exc:
            error_msg = f"Provider '{provider.name}' error: {exc}"
            if pk:
                key_service.set_error(db, pk, str(exc))
            _record_failure(db, provider, error_msg)
            last_error = error_msg
            last_error = error_msg

    raise RuntimeError(last_error)
