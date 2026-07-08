"""Shared FastAPI dependencies.

``get_user_from_api_token`` authenticates the OpenAI-compatible ``/v1`` API via a
client token (``oah-…``) presented as ``Authorization: Bearer <token>``. This is
deliberately separate from the JWT-based ``get_current_user`` used by the ``/api``
admin surface — ``/v1`` clients (OpenAI SDK, Codex, etc.) only ever hold a token.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.services.api_token_service import resolve_user

# auto_error=False so we can return an OpenAI-shaped 401 instead of FastAPI's.
_bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={
            "error": {
                "message": "Invalid or missing API key. Provide a token as "
                "'Authorization: Bearer oah-...'.",
                "type": "invalid_request_error",
                "code": "invalid_api_key",
            }
        },
    )


def get_user_from_api_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise _unauthorized()
    user = resolve_user(db, credentials.credentials.strip())
    if not user:
        raise _unauthorized()
    return user
