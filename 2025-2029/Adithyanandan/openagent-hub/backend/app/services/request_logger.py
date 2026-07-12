"""Writes request log entries for every /v1 proxy call."""
from __future__ import annotations

import time
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.request_log import RequestLog


class RequestTimer:
    __slots__ = ("_start",)

    def __init__(self):
        self._start = time.monotonic()

    @property
    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self._start) * 1000)


def log_request(
    db: Session,
    *,
    user_id: UUID,
    endpoint: str,
    provider_id: UUID | None = None,
    provider_name: str | None = None,
    model: str | None = None,
    status_code: int | None = None,
    latency_ms: int | None = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    is_stream: bool = False,
    error: str | None = None,
) -> None:
    entry = RequestLog(
        user_id=user_id,
        provider_id=provider_id,
        provider_name=provider_name,
        model=model,
        endpoint=endpoint,
        status_code=status_code,
        latency_ms=latency_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        is_stream=is_stream,
        error=error[:500] if error else None,
    )
    db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()
