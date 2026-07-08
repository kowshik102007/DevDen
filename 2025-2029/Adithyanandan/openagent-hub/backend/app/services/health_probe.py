"""Background health probes for providers.

Periodically hits each provider's ``/models`` endpoint and updates
``Provider.status`` + ``Provider.last_checked_at``.

Phase 11: Also refreshes reliability stats and resets circuit breakers
for providers that recover.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.core import crypto
from app.core.database import SessionLocal
from app.models.provider import Provider

log = logging.getLogger(__name__)

PROBE_INTERVAL = 120


async def _check_one(provider_id, base_url: str, api_key_enc: str) -> tuple[str, str | None]:
    try:
        plaintext = crypto.decrypt(api_key_enc)
        headers = {}
        if plaintext and plaintext.strip():
            headers["Authorization"] = f"Bearer {plaintext.strip()}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base_url}/models", headers=headers)
        if resp.status_code == 429:
            return "rate_limited", None
        if resp.status_code >= 400:
            return "error", f"HTTP {resp.status_code}"
        return "healthy", None
    except Exception as exc:
        return "error", str(exc)[:200]


async def _probe_round() -> None:
    db: Session = SessionLocal()
    try:
        providers = db.query(Provider).filter(Provider.enabled == True).all()
        if not providers:
            return

        tasks = []
        for p in providers:
            tasks.append(_check_one(p.id, p.base_url, p.api_key))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for p, result in zip(providers, results):
            if isinstance(result, Exception):
                p.status = "error"
            else:
                status, _err = result
                p.status = status
                if status == "healthy" and p.circuit_state != "closed":
                    p.circuit_state = "closed"
                    p.consecutive_failures = 0
                    p.cooldown_until = None
            p.last_checked_at = datetime.utcnow()

        db.commit()

        # Refresh reliability stats for all users with recent activity
        try:
            from app.services.reliability_service import refresh_reliability_stats
            from app.models.request_log import RequestLog
            from sqlalchemy import func, distinct
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(days=1)
            user_ids = db.query(distinct(RequestLog.user_id)).filter(
                RequestLog.created_at >= cutoff
            ).all()
            for (uid,) in user_ids:
                refresh_reliability_stats(db, uid, days=7)
        except Exception:
            log.debug("Reliability refresh skipped", exc_info=True)

    except Exception:
        log.exception("Health probe round failed")
        db.rollback()
    finally:
        db.close()


async def run_health_probes() -> None:
    while True:
        await asyncio.sleep(PROBE_INTERVAL)
        try:
            await _probe_round()
        except Exception:
            log.exception("Health probe loop error")
