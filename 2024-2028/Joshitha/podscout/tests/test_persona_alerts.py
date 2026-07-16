"""
Tests: Persona Alert System
============================
Tests personas, generators, delivery (mocked), and REST API endpoints.
All DB and LLM calls are mocked so no external services are needed.
"""
from __future__ import annotations

import json
import pytest
from dataclasses import asdict
from unittest.mock import AsyncMock, MagicMock, patch

from backend.app.alerts.personas import (
    Persona,
    PersonaContext,
    LocalityStats,
    _haversine_km,
    _compute_trend,
)
from backend.app.alerts.generators import AlertType, generate_alert, DEFAULT_THRESHOLD_ALERT
from backend.app.alerts.delivery import deliver_alert


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_stats(avg_pm25: float = 85.0, trend: str = "worsening") -> LocalityStats:
    return LocalityStats(
        city="Hyderabad",
        locality="Madhapur",
        lat=17.44,
        lon=78.39,
        radius_km=2.0,
        avg_pm25=avg_pm25,
        max_pm25=avg_pm25 + 30,
        min_pm25=avg_pm25 - 20,
        num_sites=6,
        critical_sites=1 if avg_pm25 >= 150 else 0,
        high_sites=2 if avg_pm25 >= 100 else 0,
        trend=trend,
        forecast_24h=avg_pm25 + 10.0,
        sources=["CPCB", "ClimPod"],
    )


def _make_ctx(persona: Persona = Persona.INDIVIDUAL, pm25: float = 85.0) -> PersonaContext:
    return PersonaContext(
        user_id="test-user-001",
        persona=persona,
        name="Arjun Sharma",
        locality="Madhapur",
        city="Hyderabad",
        language="en",
        threshold_pm25=60.0,
        stats=_make_stats(pm25),
        extra={
            "health_conditions": ["asthma"],
            "children_present": True,
            "org_name": "Madhapur RWA",
            "member_count": 450,
            "has_school": True,
            "ward_name": "Ward 46",
            "population": 80000,
            "num_sensors": 6,
        },
    )


# ---------------------------------------------------------------------------
# personas.py
# ---------------------------------------------------------------------------

class TestHaversine:
    def test_same_point(self):
        assert _haversine_km(17.44, 78.39, 17.44, 78.39) == pytest.approx(0.0, abs=1e-6)

    def test_known_distance(self):
        # Hyderabad to Secunderabad ~ 10 km
        dist = _haversine_km(17.3850, 78.4867, 17.4399, 78.4983)
        assert 5 < dist < 20

    def test_symmetric(self):
        d1 = _haversine_km(17.44, 78.39, 17.50, 78.45)
        d2 = _haversine_km(17.50, 78.45, 17.44, 78.39)
        assert d1 == pytest.approx(d2, rel=1e-6)


class TestLocalityStatsSeverity:
    def test_good(self):
        s = _make_stats(30.0)
        assert s.severity == "good"

    def test_moderate(self):
        s = _make_stats(55.0)
        assert s.severity == "moderate"

    def test_poor(self):
        s = _make_stats(80.0)
        assert s.severity == "poor"

    def test_very_poor(self):
        s = _make_stats(120.0)
        assert s.severity == "very_poor"

    def test_severe(self):
        s = _make_stats(200.0)
        assert s.severity == "severe"


class TestPersonaContext:
    def test_creation(self):
        ctx = _make_ctx()
        assert ctx.persona == Persona.INDIVIDUAL
        assert ctx.stats.avg_pm25 == 85.0

    def test_extra_fields(self):
        ctx = _make_ctx(Persona.COMMUNITY)
        assert ctx.extra["org_name"] == "Madhapur RWA"
        assert ctx.extra["has_school"] is True

    def test_municipality_context(self):
        ctx = _make_ctx(Persona.MUNICIPALITY, pm25=160.0)
        assert ctx.stats.critical_sites == 1
        assert ctx.stats.severity == "severe"


# ---------------------------------------------------------------------------
# generators.py — prompt building + LLM routing
# ---------------------------------------------------------------------------

MOCK_LLM_RESPONSE = "**Test alert content** \n\nThis is a mocked LLM response."


class TestGeneratorsPromptBuilding:
    """Verify prompts are built without errors for all 10 combinations."""

    @pytest.mark.parametrize("persona,alert_type", [
        (Persona.INDIVIDUAL,   AlertType.REALTIME_THRESHOLD),
        (Persona.INDIVIDUAL,   AlertType.DAILY_SUMMARY),
        (Persona.INDIVIDUAL,   AlertType.WEEKLY_PLAN),
        (Persona.COMMUNITY,    AlertType.COMMUNITY_THRESHOLD),
        (Persona.COMMUNITY,    AlertType.WEEKLY_DIGEST),
        (Persona.COMMUNITY,    AlertType.MONTHLY_HEALTH_PLAN),
        (Persona.MUNICIPALITY, AlertType.WARD_CRITICAL),
        (Persona.MUNICIPALITY, AlertType.CITY_DASHBOARD),
        (Persona.MUNICIPALITY, AlertType.WEEKLY_POLICY_BRIEF),
        (Persona.MUNICIPALITY, AlertType.MONTHLY_REGULATORY),
    ])
    @patch("backend.app.llm.groq_client.GroqClient.chat_completion", return_value=MOCK_LLM_RESPONSE)
    @patch("backend.app.llm.gemini_client.GeminiClient.generate_content", return_value=MOCK_LLM_RESPONSE)
    def test_all_combinations(self, mock_gemini, mock_groq, persona, alert_type):
        ctx = _make_ctx(persona)
        result = generate_alert(ctx, alert_type)
        assert isinstance(result, str)
        assert len(result) > 10

    def test_invalid_combination_raises(self):
        ctx = _make_ctx(Persona.INDIVIDUAL)
        with pytest.raises(ValueError, match="No generator registered"):
            generate_alert(ctx, AlertType.WARD_CRITICAL)  # wrong persona


class TestGeneratorsLLMFallback:
    @patch("backend.app.llm.groq_client.GroqClient.chat_completion", side_effect=RuntimeError("groq down"))
    @patch("backend.app.llm.gemini_client.GeminiClient.generate_content", return_value=MOCK_LLM_RESPONSE)
    def test_fallback_to_gemini(self, mock_gemini, mock_groq):
        ctx = _make_ctx(Persona.INDIVIDUAL)
        result = generate_alert(ctx, AlertType.REALTIME_THRESHOLD)
        assert MOCK_LLM_RESPONSE in result

    @patch("backend.app.llm.groq_client.GroqClient.chat_completion", side_effect=RuntimeError("groq down"))
    @patch("backend.app.llm.gemini_client.GeminiClient.generate_content", side_effect=RuntimeError("gemini down"))
    def test_both_fail_returns_fallback_string(self, mock_gemini, mock_groq):
        ctx = _make_ctx(Persona.INDIVIDUAL)
        result = generate_alert(ctx, AlertType.REALTIME_THRESHOLD)
        assert "Alert" in result
        assert ctx.locality in result


class TestDefaultThresholdAlerts:
    def test_individual_default(self):
        assert DEFAULT_THRESHOLD_ALERT[Persona.INDIVIDUAL] == AlertType.REALTIME_THRESHOLD

    def test_community_default(self):
        assert DEFAULT_THRESHOLD_ALERT[Persona.COMMUNITY] == AlertType.COMMUNITY_THRESHOLD

    def test_municipality_default(self):
        assert DEFAULT_THRESHOLD_ALERT[Persona.MUNICIPALITY] == AlertType.WARD_CRITICAL


# ---------------------------------------------------------------------------
# delivery.py — channel dispatch
# ---------------------------------------------------------------------------

class TestDeliveryChannels:

    @pytest.mark.asyncio
    async def test_log_channel_always_succeeds(self):
        ctx = _make_ctx()
        with patch(
            "backend.app.services.supabase.get_supabase",
            return_value=MagicMock(**{"table.return_value.insert.return_value.execute.return_value": None}),
        ):
            results = await deliver_alert(
                ctx=ctx,
                alert_type=AlertType.DAILY_SUMMARY,
                content_md="Test content",
                channels=["log"],
            )
        assert results.get("log") is True

    @pytest.mark.asyncio
    async def test_webhook_channel_posts(self):
        ctx = _make_ctx()
        import httpx
        mock_response = MagicMock(status_code=200)
        mock_response.raise_for_status = MagicMock()

        with patch.dict("os.environ", {"ALERT_WEBHOOK_URL": "https://example.com/webhook"}), \
             patch("httpx.AsyncClient") as mock_client_cls, \
             patch("backend.app.services.supabase.get_supabase", return_value=MagicMock(
                 **{"table.return_value.insert.return_value.execute.return_value": None}
             )):
            mock_client_cls.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            results = await deliver_alert(
                ctx=ctx,
                alert_type=AlertType.DAILY_SUMMARY,
                content_md="Test",
                channels=["webhook"],
            )
        assert results.get("webhook") is True

    @pytest.mark.asyncio
    async def test_email_channel_skipped_without_key(self):
        ctx = _make_ctx()
        with patch.dict("os.environ", {}, clear=False), \
             patch("backend.app.services.supabase.get_supabase", return_value=MagicMock(
                 **{"table.return_value.insert.return_value.execute.return_value": None}
             )):
            results = await deliver_alert(
                ctx=ctx,
                alert_type=AlertType.DAILY_SUMMARY,
                content_md="Test",
                channels=["email"],
                to_email="user@example.com",
            )
        # Returns False when SENDGRID_API_KEY not set
        assert results.get("email") is False

    @pytest.mark.asyncio
    async def test_unknown_channel_handled_gracefully(self):
        ctx = _make_ctx()
        with patch("backend.app.services.supabase.get_supabase", return_value=MagicMock(
            **{"table.return_value.insert.return_value.execute.return_value": None}
        )):
            results = await deliver_alert(
                ctx=ctx,
                alert_type=AlertType.DAILY_SUMMARY,
                content_md="Test",
                channels=["log", "unknown_channel"],
            )
        assert results.get("log") is True
        assert results.get("unknown_channel") is False


# ---------------------------------------------------------------------------
# API endpoints — using FastAPI TestClient
# ---------------------------------------------------------------------------

class TestAlertsAPI:
    """Integration-style tests using FastAPI TestClient with mocked auth + DB."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from backend.app.api.v1.alerts import router
        from backend.app.middleware.auth import get_current_user

        app = FastAPI()
        app.include_router(router, prefix="/api/v1")

        # Override auth dependency
        fake_user = {"id": "test-user-001", "email": "arjun@example.com"}
        app.dependency_overrides[get_current_user] = lambda: fake_user

        self.client = TestClient(app)
        self.fake_user = fake_user

    def _mock_supabase(self, profile: dict | None = None):
        """Returns a mock supabase client."""
        mock_sb = MagicMock()
        default_profile = {
            "id": "test-user-001",
            "email": "arjun@example.com",
            "full_name": "Arjun Sharma",
            "persona": "individual",
            "locality": "Madhapur",
            "locality_radius_km": 2.0,
            "notification_channels": {"email": True, "whatsapp": False},
            "persona_meta": {},
            "alert_threshold_pm25": 60.0,
            "preferred_language": "en",
            "default_city": "Hyderabad",
            "home_lat": 17.44,
            "home_lon": 78.39,
            "has_respiratory_condition": False,
            "user_group": "general",
        }
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = (
            profile or default_profile
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{}]
        mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = []
        mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = []
        mock_sb.table.return_value.insert.return_value.execute.return_value.data = [{"id": "new-sub-id"}]
        return mock_sb

    def test_get_profile_returns_200(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.get("/api/v1/alerts/profile/me")
        assert resp.status_code == 200

    def test_update_profile_valid_persona(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.put(
                "/api/v1/alerts/profile/me",
                json={"persona": "community", "locality": "HITEC City"},
            )
        assert resp.status_code == 200
        assert resp.json()["updated"] is True

    def test_update_profile_invalid_persona_returns_422(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.put(
                "/api/v1/alerts/profile/me",
                json={"persona": "hacker"},
            )
        assert resp.status_code == 422

    def test_create_subscription(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.post(
                "/api/v1/alerts/subscriptions",
                json={"trigger": "daily_summary", "channels": ["log", "email"]},
            )
        assert resp.status_code == 201

    def test_create_subscription_invalid_trigger(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.post(
                "/api/v1/alerts/subscriptions",
                json={"trigger": "never_heard_of_it"},
            )
        assert resp.status_code == 422

    def test_list_subscriptions(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.get("/api/v1/alerts/subscriptions")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_delivery_history_pagination(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.get("/api/v1/alerts/history?page=1&per_page=10")
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert body["page"] == 1

    def test_preview_alert(self):
        ctx = _make_ctx()
        mock_content = "**Test Alert** Generated content for Madhapur"
        with patch("backend.app.alerts.personas.build_context", new_callable=AsyncMock, return_value=ctx), \
             patch("backend.app.alerts.generators.generate_alert", return_value=mock_content), \
             patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.post(
                "/api/v1/alerts/preview",
                json={"alert_type": "daily_summary"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["content_md"] == mock_content
        assert body["alert_type"] == "daily_summary"

    def test_preview_invalid_alert_type(self):
        with patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.post(
                "/api/v1/alerts/preview",
                json={"alert_type": "i_made_this_up"},
            )
        assert resp.status_code == 422

    def test_trigger_alert(self):
        ctx = _make_ctx()
        mock_content = "**Triggered Alert** for Madhapur"
        mock_results = {"log": True, "email": False}

        with patch("backend.app.alerts.personas.build_context", new_callable=AsyncMock, return_value=ctx), \
             patch("backend.app.alerts.generators.generate_alert", return_value=mock_content), \
             patch("backend.app.alerts.delivery.deliver_alert", new_callable=AsyncMock, return_value=mock_results), \
             patch("backend.app.api.v1.alerts._supabase", return_value=self._mock_supabase()):
            resp = self.client.post(
                "/api/v1/alerts/trigger",
                json={"alert_type": "daily_summary", "channels": ["log"]},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["alert_type"] == "daily_summary"
        assert "channels" in body
