"""Smart API key selection and rate-limit accounting for multi-key providers.

Each provider can have multiple ProviderKey rows. This module:
- Picks the best available key (least-loaded, not on cooldown)
- Records usage from upstream ``x-ratelimit-*`` response headers
- Puts keys on cooldown when a 429 is received
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.core import crypto
from app.models.provider import Provider
from app.models.provider_key import ProviderKey

COOLDOWN_SECONDS = 60
WINDOW_SECONDS = 60


def pick_key(db: Session, provider: Provider) -> Optional[ProviderKey]:
    """Return the best active, non-cooldown key for *provider*, or None."""
    now = datetime.utcnow()
    keys = (
        db.query(ProviderKey)
        .filter(
            ProviderKey.provider_id == provider.id,
            ProviderKey.is_active == True,
        )
        .all()
    )
    if not keys:
        return None

    candidates = []
    for k in keys:
        if k.cooldown_until and k.cooldown_until > now:
            continue
        candidates.append(k)

    if not candidates:
        return None

    # Sort by rpm_remaining desc (most headroom first), then by requests_used asc.
    # Keys with no limit info (None) are treated as unlimited (sort last among equals).
    def _score(k: ProviderKey) -> tuple:
        remaining = k.rpm_remaining if k.rpm_remaining is not None else 999_999
        used = k.requests_used or 0
        return (-remaining, used)

    candidates.sort(key=_score)
    return candidates[0]


def decrypt_key(key: ProviderKey) -> str:
    """Decrypt the stored API key."""
    return crypto.decrypt(key.api_key)


def record_usage(
    db: Session,
    key: ProviderKey,
    response_headers: dict | None = None,
    tokens_used: int = 0,
) -> None:
    """Update a key's rate-limit metadata from upstream response headers."""
    now = datetime.utcnow()
    key.last_used_at = now
    key.requests_used = (key.requests_used or 0) + 1
    key.tokens_used = (key.tokens_used or 0) + tokens_used

    # Reset rolling window counters after WINDOW_SECONDS
    if key.window_start and (now - key.window_start).total_seconds() > WINDOW_SECONDS:
        key.requests_used = 1
        key.tokens_used = tokens_used
        key.window_start = now
    elif not key.window_start:
        key.window_start = now

    if response_headers:
        _parse_ratelimit_headers(key, response_headers)

    db.add(key)
    db.commit()


def set_cooldown(db: Session, key: ProviderKey, seconds: int | None = None) -> None:
    """Put a key on cooldown (e.g. after a 429)."""
    secs = seconds or COOLDOWN_SECONDS
    key.cooldown_until = datetime.utcnow() + timedelta(seconds=secs)
    key.rpm_remaining = 0
    db.add(key)
    db.commit()


def set_error(db: Session, key: ProviderKey, error: str) -> None:
    """Record a non-429 error on a key."""
    key.last_error = error[:500]
    db.add(key)
    db.commit()


def _parse_ratelimit_headers(key: ProviderKey, headers: dict) -> None:
    """Parse OpenAI-style x-ratelimit-* headers."""
    def _int(name: str) -> Optional[int]:
        val = headers.get(name)
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
        key.rpm_limit = rpm_limit
    if tpm_limit is not None:
        key.tpm_limit = tpm_limit
    if rpm_remaining is not None:
        key.rpm_remaining = rpm_remaining
    if tpm_remaining is not None:
        key.tpm_remaining = tpm_remaining

    # Parse reset time (e.g. "6s", "1m30s", "200ms")
    reset_str = headers.get("x-ratelimit-reset-requests")
    if reset_str:
        secs = _parse_duration(reset_str)
        if secs:
            key.limit_reset_at = datetime.utcnow() + timedelta(seconds=secs)

    # Retry-After (integer seconds) on 429
    retry_after = headers.get("retry-after")
    if retry_after:
        try:
            secs = int(retry_after)
            key.cooldown_until = datetime.utcnow() + timedelta(seconds=secs)
        except (ValueError, TypeError):
            pass


def _parse_duration(s: str) -> float | None:
    """Parse durations like '6s', '1m30s', '200ms'."""
    import re
    total = 0.0
    for amount, unit in re.findall(r"(\d+(?:\.\d+)?)(ms|m|s|h)", s):
        v = float(amount)
        if unit == "h":
            total += v * 3600
        elif unit == "m":
            total += v * 60
        elif unit == "s":
            total += v
        elif unit == "ms":
            total += v / 1000
    return total if total > 0 else None
