"""OpenAI-compatible public API, mounted at ``/v1`` (NOT under ``/api``).

Authenticated by a client token (``oah-…``) via ``get_user_from_api_token``.
Point the OpenAI SDK / Codex / any OpenAI client at ``<host>/v1`` with one of
these tokens and it routes through the user's free-tier providers with failover.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_user_from_api_token
from app.core.database import get_db
from app.models.model_catalog import ModelCatalog
from app.models.user import User
from app.services import openai_proxy
from app.services import responses_shim
from app.services.request_logger import log_request, RequestTimer

router = APIRouter(prefix="/v1", tags=["openai-compat"])


def _error(message: str, status: int, code: str, type_: str = "invalid_request_error"):
    return JSONResponse(
        status_code=status,
        content={"error": {"message": message, "type": type_, "code": code}},
    )


def _provider_id(request: Request) -> str | None:
    return request.headers.get("x-provider-id") or None


@router.post("/chat/completions")
async def chat_completions(
    request: Request,
    user: User = Depends(get_user_from_api_token),
    db: Session = Depends(get_db),
):
    try:
        body = await request.json()
    except Exception:
        return _error("Request body must be valid JSON.", 400, "invalid_body")
    if not isinstance(body, dict) or not body.get("messages"):
        return _error("'messages' is required.", 400, "missing_messages")

    pref = _provider_id(request)
    stream = bool(body.get("stream"))
    model = body.get("model", "auto")
    timer = RequestTimer()

    if stream:
        async def event_stream():
            try:
                async for line in openai_proxy.stream(db, user.id, body, preferred_provider_id=pref):
                    yield line
                log_request(db, user_id=user.id, endpoint="/v1/chat/completions",
                            model=model, status_code=200, latency_ms=timer.elapsed_ms, is_stream=True)
            except openai_proxy.NoProvidersError as exc:
                yield f"data: {json.dumps({'error': {'message': str(exc), 'type': 'invalid_request_error', 'code': 'no_providers'}})}\n\n"
                log_request(db, user_id=user.id, endpoint="/v1/chat/completions",
                            model=model, status_code=400, latency_ms=timer.elapsed_ms, is_stream=True, error=str(exc))
            except Exception as exc:
                yield f"data: {json.dumps({'error': {'message': str(exc), 'type': 'api_error', 'code': 'upstream_error'}})}\n\n"
                log_request(db, user_id=user.id, endpoint="/v1/chat/completions",
                            model=model, status_code=502, latency_ms=timer.elapsed_ms, is_stream=True, error=str(exc))

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        data = await openai_proxy.completion(db, user.id, body, preferred_provider_id=pref)
        usage = data.get("usage") or {}
        log_request(db, user_id=user.id, endpoint="/v1/chat/completions",
                    model=model, status_code=200, latency_ms=timer.elapsed_ms,
                    prompt_tokens=usage.get("prompt_tokens", 0),
                    completion_tokens=usage.get("completion_tokens", 0),
                    total_tokens=usage.get("total_tokens", 0))
        return JSONResponse(content=data)
    except openai_proxy.NoProvidersError as exc:
        log_request(db, user_id=user.id, endpoint="/v1/chat/completions",
                    model=model, status_code=400, latency_ms=timer.elapsed_ms, error=str(exc))
        return _error(str(exc), 400, "no_providers")
    except Exception as exc:
        log_request(db, user_id=user.id, endpoint="/v1/chat/completions",
                    model=model, status_code=502, latency_ms=timer.elapsed_ms, error=str(exc))
        return _error(str(exc), 502, "upstream_error", type_="api_error")


@router.post("/responses")
async def create_response(
    request: Request,
    user: User = Depends(get_user_from_api_token),
    db: Session = Depends(get_db),
):
    try:
        body = await request.json()
    except Exception:
        return _error("Request body must be valid JSON.", 400, "invalid_body")
    if not isinstance(body, dict) or not body.get("input"):
        return _error("'input' is required.", 400, "missing_input")

    pref = _provider_id(request)
    do_stream = bool(body.get("stream"))
    model = body.get("model", "auto")
    timer = RequestTimer()

    if do_stream:
        async def event_stream():
            try:
                async for line in responses_shim.stream_response(db, user.id, body, preferred_provider_id=pref):
                    yield line
                log_request(db, user_id=user.id, endpoint="/v1/responses",
                            model=model, status_code=200, latency_ms=timer.elapsed_ms, is_stream=True)
            except openai_proxy.NoProvidersError as exc:
                err = {"type": "error", "code": "no_providers", "message": str(exc)}
                yield f"event: error\ndata: {json.dumps(err)}\n\n"
                log_request(db, user_id=user.id, endpoint="/v1/responses",
                            model=model, status_code=400, latency_ms=timer.elapsed_ms, is_stream=True, error=str(exc))
            except Exception as exc:
                err = {"type": "error", "code": "upstream_error", "message": str(exc)}
                yield f"event: error\ndata: {json.dumps(err)}\n\n"
                log_request(db, user_id=user.id, endpoint="/v1/responses",
                            model=model, status_code=502, latency_ms=timer.elapsed_ms, is_stream=True, error=str(exc))

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        data = await responses_shim.create_response(db, user.id, body, preferred_provider_id=pref)
        usage = data.get("usage") or {}
        log_request(db, user_id=user.id, endpoint="/v1/responses",
                    model=model, status_code=200, latency_ms=timer.elapsed_ms,
                    prompt_tokens=usage.get("input_tokens", 0),
                    completion_tokens=usage.get("output_tokens", 0),
                    total_tokens=usage.get("total_tokens", 0))
        return JSONResponse(content=data)
    except openai_proxy.NoProvidersError as exc:
        log_request(db, user_id=user.id, endpoint="/v1/responses",
                    model=model, status_code=400, latency_ms=timer.elapsed_ms, error=str(exc))
        return _error(str(exc), 400, "no_providers")
    except Exception as exc:
        log_request(db, user_id=user.id, endpoint="/v1/responses",
                    model=model, status_code=502, latency_ms=timer.elapsed_ms, error=str(exc))
        return _error(str(exc), 502, "upstream_error", type_="api_error")


@router.post("/embeddings")
async def create_embeddings(
    request: Request,
    user: User = Depends(get_user_from_api_token),
    db: Session = Depends(get_db),
):
    try:
        body = await request.json()
    except Exception:
        return _error("Request body must be valid JSON.", 400, "invalid_body")
    if not isinstance(body, dict) or not body.get("model"):
        return _error("'model' is required.", 400, "missing_model")
    if not body.get("input"):
        return _error("'input' is required.", 400, "missing_input")

    pref = _provider_id(request)
    model = body.get("model", "")
    timer = RequestTimer()
    try:
        data = await openai_proxy.embeddings(db, user.id, body, preferred_provider_id=pref)
        usage = data.get("usage") or {}
        log_request(db, user_id=user.id, endpoint="/v1/embeddings",
                    model=model, status_code=200, latency_ms=timer.elapsed_ms,
                    total_tokens=usage.get("total_tokens", 0))
        return JSONResponse(content=data)
    except openai_proxy.NoProvidersError as exc:
        log_request(db, user_id=user.id, endpoint="/v1/embeddings",
                    model=model, status_code=400, latency_ms=timer.elapsed_ms, error=str(exc))
        return _error(str(exc), 400, "no_providers")
    except Exception as exc:
        log_request(db, user_id=user.id, endpoint="/v1/embeddings",
                    model=model, status_code=502, latency_ms=timer.elapsed_ms, error=str(exc))
        return _error(str(exc), 502, "upstream_error", type_="api_error")


@router.get("/models")
def list_models(
    user: User = Depends(get_user_from_api_token),
    db: Session = Depends(get_db),
):
    """OpenAI list shape from the user's free-tier catalog (deduped by model id)."""
    rows = (
        db.query(ModelCatalog)
        .filter(ModelCatalog.user_id == user.id, ModelCatalog.is_enabled == True)
        .all()
    )
    seen: set[str] = set()
    data = []
    for r in rows:
        if r.model_id in seen:
            continue
        seen.add(r.model_id)
        data.append(
            {
                "id": r.model_id,
                "object": "model",
                "created": 0,
                "owned_by": r.provider_name or "openagent",
            }
        )
    # Always expose the smart-routing sentinel.
    data.insert(0, {"id": "auto", "object": "model", "created": 0, "owned_by": "openagent"})
    return {"object": "list", "data": data}
