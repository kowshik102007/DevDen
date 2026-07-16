"""
Tests for FastAPI authentication middleware.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_app():
    """Return a minimal FastAPI app that uses get_current_user."""
    from fastapi import Depends
    from backend.app.middleware.auth import get_current_user

    app = FastAPI()

    @app.get("/protected")
    async def protected(user: dict = Depends(get_current_user)):
        return {"user_id": user.get("id")}

    return app


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAuthMiddleware:
    def test_missing_token_returns_403(self):
        """No Authorization header → 403 (HTTPBearer auto_error=True)."""
        app = _make_app()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/protected")
        assert resp.status_code == 403

    def test_invalid_token_returns_401(self):
        """A token that fails Supabase validation → 401."""
        from backend.app.middleware import auth as auth_module

        app = _make_app()
        client = TestClient(app, raise_server_exceptions=False)

        with patch.object(
            auth_module,
            "_validate_token",
            side_effect=__import__("fastapi").HTTPException(
                status_code=401, detail="Invalid or expired token"
            ),
        ):
            resp = client.get("/protected", headers={"Authorization": "Bearer bad-token"})
        assert resp.status_code == 401

    def test_valid_token_passes_user(self):
        """A valid token should let the request through and return user id."""
        from backend.app.middleware import auth as auth_module

        fake_user = {"id": "user-123", "email": "test@example.com"}

        app = _make_app()
        client = TestClient(app)

        with patch.object(auth_module, "_validate_token", return_value=fake_user):
            resp = client.get("/protected", headers={"Authorization": "Bearer good-token"})

        assert resp.status_code == 200
        assert resp.json()["user_id"] == "user-123"

    def test_admin_endpoint_rejects_non_admin(self):
        """User without admin role in app_metadata → 403."""
        from fastapi import Depends
        from backend.app.middleware.auth import get_admin_user, _validate_token
        from backend.app.middleware import auth as auth_module

        app = FastAPI()

        @app.get("/admin-only")
        async def admin_route(user: dict = Depends(get_admin_user)):
            return {"ok": True}

        non_admin_user = {"id": "u1", "app_metadata": {"role": "user"}}

        client = TestClient(app, raise_server_exceptions=False)
        with patch.object(auth_module, "_validate_token", return_value=non_admin_user):
            resp = client.get("/admin-only", headers={"Authorization": "Bearer token"})

        assert resp.status_code == 403

    def test_admin_endpoint_accepts_admin(self):
        """User with role=admin in app_metadata → 200."""
        from fastapi import Depends
        from backend.app.middleware.auth import get_admin_user
        from backend.app.middleware import auth as auth_module

        app = FastAPI()

        @app.get("/admin-only")
        async def admin_route(user: dict = Depends(get_admin_user)):
            return {"ok": True}

        admin_user = {"id": "a1", "app_metadata": {"role": "admin"}}

        client = TestClient(app)
        with patch.object(auth_module, "_validate_token", return_value=admin_user):
            resp = client.get("/admin-only", headers={"Authorization": "Bearer token"})

        assert resp.status_code == 200
        assert resp.json()["ok"] is True
