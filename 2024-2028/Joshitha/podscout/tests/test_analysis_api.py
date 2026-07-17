"""
Tests for /api/v1/analysis endpoints.
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
# Fake auth — bypass real JWT validation for all analysis tests
# ---------------------------------------------------------------------------
FAKE_USER = {"id": "test-user", "email": "tester@example.com", "app_metadata": {}}


def _make_test_client():
    from backend.app.api.v1.analysis import router
    from backend.app.middleware import auth as auth_module

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    # Override all auth dependencies
    from backend.app.middleware.auth import get_current_user
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER

    return TestClient(app)


# ---------------------------------------------------------------------------
# /hotspots
# ---------------------------------------------------------------------------
class TestHotspotsEndpoint:
    def test_returns_hotspots_list(self):
        from backend.app.services import supabase as sb_module

        mock_supabase = MagicMock()
        fake_rows = [
            {"id": "s1", "city": "Delhi", "site_name": "ITO", "latitude": 28.6, "longitude": 77.2, "avg_pm25": 280.0},
            {"id": "s2", "city": "Mumbai", "site_name": "Bandra", "latitude": 19.0, "longitude": 72.8, "avg_pm25": 95.0},
        ]
        mock_supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = fake_rows

        client = _make_test_client()
        with patch.object(sb_module, "get_supabase", return_value=mock_supabase):
            resp = client.get("/api/v1/analysis/hotspots", headers={"Authorization": "Bearer tok"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 2
        assert body["hotspots"][0]["severity"] == "severe"   # pm25=280
        assert body["hotspots"][1]["severity"] == "moderate"  # pm25=95

    def test_db_unavailable_returns_503(self):
        from backend.app.services import supabase as sb_module

        client = _make_test_client()
        with patch.object(sb_module, "get_supabase", return_value=None):
            resp = client.get("/api/v1/analysis/hotspots", headers={"Authorization": "Bearer tok"})

        assert resp.status_code == 503

    def test_unauthenticated_returns_403(self):
        from backend.app.api.v1.analysis import router
        from backend.app.middleware.auth import get_current_user

        # Fresh app WITHOUT the dependency override
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get("/api/v1/analysis/hotspots")
        assert resp.status_code == 403

    def test_city_filter_applied(self):
        from backend.app.services import supabase as sb_module

        mock_supabase = MagicMock()
        # The query chain: .select().order().limit().eq().execute()
        chain = mock_supabase.table.return_value.select.return_value.order.return_value.limit.return_value
        chain.eq.return_value.execute.return_value.data = []

        client = _make_test_client()
        with patch.object(sb_module, "get_supabase", return_value=mock_supabase):
            resp = client.get(
                "/api/v1/analysis/hotspots?city=Delhi",
                headers={"Authorization": "Bearer tok"},
            )

        assert resp.status_code == 200
        # Verify .eq("city", "Delhi") was called
        chain.eq.assert_called_once_with("city", "Delhi")


# ---------------------------------------------------------------------------
# /site analysis
# ---------------------------------------------------------------------------
class TestAnalyzeSiteEndpoint:
    def test_analyze_returns_200(self):
        from backend.app.llm import orchestrator as orch_module

        mock_orch = MagicMock()
        mock_orch.analyze_site.return_value = {"aqi": 300, "primary_pollutant": "pm25"}
        mock_orch.explain_to_user.return_value = "Air quality is hazardous."

        client = _make_test_client()
        payload = {"id": "site-1", "lat": 28.6, "lon": 77.2, "pm25": 300.0}

        with patch.object(orch_module, "orchestrator", mock_orch):
            resp = client.post(
                "/api/v1/analysis/site",
                json=payload,
                headers={"Authorization": "Bearer tok"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["site_id"] == "site-1"
        assert "explanation" in body
