"""
Authentication dependencies for FastAPI.

Provides FastAPI-compatible Depends() objects for:
- require_auth  — endpoint must have a valid Bearer token
- optional_auth — endpoint works with or without a token
- require_admin — endpoint must have admin role in app_metadata
"""
import logging
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_bearer_scheme          = HTTPBearer(auto_error=True)
_bearer_scheme_optional = HTTPBearer(auto_error=False)


def _validate_token(token: str) -> Dict[str, Any]:
    """Call the Supabase auth service and return the user dict."""
    from backend.app.services.auth import auth  # lazy to avoid circular imports
    result = auth.get_user(token)
    if result.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result.get("error", "Invalid or expired token"),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return result["user"]


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> Dict[str, Any]:
    """
    FastAPI dependency — resolves the current authenticated user.

    Add to any endpoint that must be protected::

        @router.get("/protected")
        async def handler(user: dict = Depends(get_current_user)):
            ...
    """
    return _validate_token(credentials.credentials)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme_optional),
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency — resolves the user if a token is provided, else returns None.

    Used for endpoints that work anonymously but offer richer responses when authed.
    """
    if credentials is None:
        return None
    try:
        return _validate_token(credentials.credentials)
    except HTTPException:
        return None


async def get_admin_user(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    FastAPI dependency — requires admin role in app_metadata.

    Usage::

        @router.delete("/resource/{id}")
        async def delete(user: dict = Depends(get_admin_user)):
            ...
    """
    app_metadata = user.get("app_metadata") or {}
    if app_metadata.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


# Convenience aliases that mirror the old decorator names
require_auth  = Depends(get_current_user)
optional_auth = Depends(get_optional_user)
require_admin = Depends(get_admin_user)
