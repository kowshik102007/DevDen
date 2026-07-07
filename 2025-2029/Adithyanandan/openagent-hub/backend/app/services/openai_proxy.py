"""Reverse-proxy core for the OpenAI-compatible ``/v1`` API.

Forwards an OpenAI-shaped request body to one of the user's providers, with
priority + failover routing reused from ``router_service``. Unlike the agent
pipeline this is a faithful pass-through: it preserves ``usage``, ``tool_calls``,
and the upstream SSE chunks byte-for-byte, so the OpenAI SDK / Codex see exactly
what they expect.

Phase 11: Uses circuit breaker pattern for resilient failover.
"""
from __future__ import annotations

import json
from typing import AsyncIterator
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core import crypto
from app.models.provider import Provider
from app.services.router_service import (
    _resolve_attempts,
    _filter_vision,
    _is_circuit_open,
    _record_success,
    _record_failure,
    _update_quota,
)
from app.services.routing_service import is_auto, choose_models
from app.services import key_service

_CONTROL_FIELDS = {"model"}


class NoProvidersError(Exception):
    """No enabled provider can serve the requested model."""


def _has_image(messages: list[dict]) -> bool:
    for m in messages:
        content = m.get("content")
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    return True
    return False


def build_attempts(
    db: Session,
    user_id: UUID,
    model: str,
    messages: list[dict],
    preferred_provider_id: str | None = None,
) -> list[tuple[str, Provider]]:
    has_image = _has_image(messages)
    if is_auto(model):
        ranked = choose_models(
            db, user_id, messages, has_image, preferred_provider_id
        )
        model_order = [(mid, pid) for mid, pid, _reason in ranked]
        attempts = _resolve_attempts(db, user_id, "", preferred_provider_id, model_order)
    else:
        attempts = _resolve_attempts(db, user_id, model, preferred_provider_id, None)
    if has_image:
        attempts = _filter_vision(db, user_id, attempts)
    return attempts


def _forward_payload(body: dict, attempt_model: str, stream: bool) -> dict:
    payload = {k: v for k, v in body.items() if k not in _CONTROL_FIELDS}
    payload["model"] = attempt_model
    payload["stream"] = stream
    return payload


async def completion(
    db: Session,
    user_id: UUID,
    body: dict,
    preferred_provider_id: str | None = None,
) -> dict:
    model = body.get("model") or "auto"
    messages = body.get("messages") or []
    attempts = build_attempts(db, user_id, model, messages, preferred_provider_id)
    if not attempts:
        raise NoProvidersError("No enabled providers can serve this model.")

    last_error = "All providers failed."
    for attempt_model, provider in attempts:
        if _is_circuit_open(provider):
            continue
        headers, pk = _auth_headers(db, provider)
        payload = _forward_payload(body, attempt_model, stream=False)
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{provider.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
            if resp.status_code >= 400:
                error_msg = f"Provider '{provider.name}' HTTP {resp.status_code}: {resp.text[:300]}"
                if pk:
                    if resp.status_code == 429:
                        key_service.set_cooldown(db, pk)
                    else:
                        key_service.set_error(db, pk, f"HTTP {resp.status_code}")
                _record_failure(db, provider, error_msg, resp.status_code)
                last_error = error_msg
                continue
            data = resp.json()
            _record_success(db, provider)
            _update_quota(db, provider, dict(resp.headers))
            if pk:
                tokens = data.get("usage", {}).get("total_tokens", 0)
                key_service.record_usage(db, pk, dict(resp.headers), tokens)
            data.setdefault("model", attempt_model)
            return data
        except httpx.HTTPError as exc:
            error_msg = f"Provider '{provider.name}' error: {exc}"
            if pk:
                key_service.set_error(db, pk, str(exc))
            _record_failure(db, provider, error_msg)
            last_error = error_msg

    raise RuntimeError(last_error)


async def stream(
    db: Session,
    user_id: UUID,
    body: dict,
    preferred_provider_id: str | None = None,
) -> AsyncIterator[str]:
    model = body.get("model") or "auto"
    messages = body.get("messages") or []
    attempts = build_attempts(db, user_id, model, messages, preferred_provider_id)
    if not attempts:
        raise NoProvidersError("No enabled providers can serve this model.")

    last_error = "All providers failed."
    for attempt_model, provider in attempts:
        if _is_circuit_open(provider):
            continue
        headers, pk = _auth_headers(db, provider)
        payload = _forward_payload(body, attempt_model, stream=True)
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{provider.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status_code >= 400:
                        body_text = (await resp.aread()).decode("utf-8", "replace")[:300]
                        error_msg = f"Provider '{provider.name}' HTTP {resp.status_code}: {body_text}"
                        if pk:
                            if resp.status_code == 429:
                                key_service.set_cooldown(db, pk)
                            else:
                                key_service.set_error(db, pk, f"HTTP {resp.status_code}")
                        _record_failure(db, provider, error_msg, resp.status_code)
                        last_error = error_msg
                        continue
                    _record_success(db, provider)
                    _update_quota(db, provider, dict(resp.headers))
                    if pk:
                        key_service.record_usage(db, pk, dict(resp.headers))
                    async for line in resp.aiter_lines():
                        if line:
                            yield f"{line}\n\n"
                    yield "data: [DONE]\n\n"
                    return
        except httpx.HTTPError as exc:
            error_msg = f"Provider '{provider.name}' error: {exc}"
            if pk:
                key_service.set_error(db, pk, str(exc))
            _record_failure(db, provider, error_msg)
            last_error = error_msg

    raise RuntimeError(last_error)


async def embeddings(
    db: Session,
    user_id: UUID,
    body: dict,
    preferred_provider_id: str | None = None,
) -> dict:
    model = body.get("model", "")
    attempts = _resolve_attempts(db, user_id, model, preferred_provider_id, None)
    if not attempts:
        raise NoProvidersError("No enabled providers can serve this embedding model.")

    last_error = "All providers failed."
    for attempt_model, provider in attempts:
        if _is_circuit_open(provider):
            continue
        headers, pk = _auth_headers(db, provider)
        payload = dict(body, model=attempt_model)
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{provider.base_url}/embeddings",
                    headers=headers,
                    json=payload,
                )
            if resp.status_code >= 400:
                error_msg = f"Provider '{provider.name}' HTTP {resp.status_code}: {resp.text[:300]}"
                if pk:
                    if resp.status_code == 429:
                        key_service.set_cooldown(db, pk)
                    else:
                        key_service.set_error(db, pk, f"HTTP {resp.status_code}")
                _record_failure(db, provider, error_msg, resp.status_code)
                last_error = error_msg
                continue
            data = resp.json()
            _record_success(db, provider)
            _update_quota(db, provider, dict(resp.headers))
            if pk:
                tokens = data.get("usage", {}).get("total_tokens", 0)
                key_service.record_usage(db, pk, dict(resp.headers), tokens)
            return data
        except httpx.HTTPError as exc:
            error_msg = f"Provider '{provider.name}' error: {exc}"
            if pk:
                key_service.set_error(db, pk, str(exc))
            _record_failure(db, provider, error_msg)
            last_error = error_msg

    raise RuntimeError(last_error)


def _auth_headers(db: Session, provider: Provider):
    pk = key_service.pick_key(db, provider)
    if pk:
        plaintext = key_service.decrypt_key(pk)
    else:
        plaintext = crypto.decrypt(provider.api_key)
    headers = {"Content-Type": "application/json"}
    if plaintext and plaintext.strip():
        headers["Authorization"] = f"Bearer {plaintext.strip()}"
    return headers, pk
