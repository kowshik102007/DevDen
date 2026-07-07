"""Client API tokens for the OpenAI-compatible ``/v1`` API.

Tokens look like ``oah-<43 url-safe base64 chars>`` (256 bits of entropy). Only
a SHA-256 hash is stored; the plaintext is returned exactly once at creation.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.api_token import ApiToken
from app.models.user import User

_PREFIX = "oah-"


def _generate_token() -> str:
    # token_urlsafe(32) → 43 chars, 256 bits of entropy.
    return f"{_PREFIX}{secrets.token_urlsafe(32)}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _display_prefix(token: str) -> str:
    # e.g. "oah-AbCdEf…" — enough to recognise, not enough to use.
    head = token[: len(_PREFIX) + 6]
    return f"{head}…"


def list_tokens(db: Session, user_id: UUID) -> list[ApiToken]:
    return (
        db.query(ApiToken)
        .filter(ApiToken.user_id == user_id)
        .order_by(ApiToken.created_at.desc())
        .all()
    )


def create_token(db: Session, user_id: UUID, name: str) -> tuple[ApiToken, str]:
    """Create a token. Returns (row, plaintext) — plaintext is shown only here."""
    plaintext = _generate_token()
    row = ApiToken(
        user_id=user_id,
        name=(name or "token").strip()[:80] or "token",
        token_hash=hash_token(plaintext),
        prefix=_display_prefix(plaintext),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, plaintext


def revoke_token(db: Session, user_id: UUID, token_id: UUID) -> None:
    row = (
        db.query(ApiToken)
        .filter(ApiToken.id == token_id, ApiToken.user_id == user_id)
        .first()
    )
    if not row:
        raise ValueError("Token not found")
    row.revoked = True
    db.commit()


def resolve_user(db: Session, token: str) -> User | None:
    """Look up the owning user for a presented plaintext token, or None.

    Updates ``last_used_at`` on a successful, non-revoked match."""
    if not token or not token.startswith(_PREFIX):
        return None
    row = (
        db.query(ApiToken)
        .filter(ApiToken.token_hash == hash_token(token), ApiToken.revoked == False)
        .first()
    )
    if not row:
        return None
    row.last_used_at = datetime.utcnow()
    db.commit()
    return db.query(User).filter(User.id == row.user_id).first()
