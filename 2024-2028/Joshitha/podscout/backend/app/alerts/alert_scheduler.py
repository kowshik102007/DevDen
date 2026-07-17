"""
Alert Scheduler
================
Coordinates periodic and event-driven alert generation + delivery.

Used in two modes:
  1. Called directly from realtime_pipeline.py after each ingestion cycle
     → check_threshold_breaches()

  2. Called from Celery Beat tasks at scheduled times:
     → run_daily_summaries()    — every day at 02:30 UTC (08:00 IST)
     → run_weekly_plans()       — every Monday at 02:30 UTC
     → run_monthly_reports()    — 1st of month at 03:00 UTC

Each method:
  a. Queries users with active subscriptions for that trigger type
  b. Builds PersonaContext for each user
  c. Calls generate_alert() to produce LLM content
  d. Calls deliver_alert() through the user's notification channels
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from .personas import PersonaContext, build_context
from .generators import AlertType, generate_alert, DEFAULT_THRESHOLD_ALERT
from .delivery import deliver_alert

logger = logging.getLogger(__name__)


class AlertScheduler:
    """
    Central coordinator for persona-based alert generation and delivery.
    Instantiate once and call the async run_* methods from Celery tasks.
    """

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _load_subscriptions(self, trigger: str) -> List[Dict[str, Any]]:
        """
        Return rows from alert_subscriptions joined with user_profiles
        for the given trigger type that are active.
        """
        try:
            from backend.app.services.supabase import get_supabase
            supabase = get_supabase()
            if not supabase:
                return []
            res = (
                supabase.table("alert_subscriptions")
                .select("*, user_profiles!inner(id, email, phone, persona, locality, default_city, "
                        "locality_radius_km, notification_channels, persona_meta, preferred_language, "
                        "full_name, home_lat, home_lon, alert_threshold_pm25, "
                        "has_respiratory_condition, user_group)")
                .eq("trigger", trigger)
                .eq("active", True)
                .execute()
            )
            return res.data or []
        except Exception as e:
            logger.error("Failed to load subscriptions for trigger=%r: %s", trigger, e)
            return []

    @staticmethod
    def _channels_from_profile(profile: Dict[str, Any]) -> List[str]:
        """Resolve delivery channels for a user, always including 'log'."""
        stored = profile.get("notification_channels") or {}
        channels = ["log"]
        if isinstance(stored, dict):
            if stored.get("webhook"):
                channels.append("webhook")
            if stored.get("email"):
                channels.append("email")
            if stored.get("sms"):
                channels.append("sms")
            if stored.get("whatsapp"):
                channels.append("whatsapp")
        elif isinstance(stored, list):
            channels.extend(c for c in stored if c not in channels)
        return channels

    async def _send_to_subscription(
        self,
        sub: Dict[str, Any],
        alert_type: AlertType,
    ) -> bool:
        """Build context, generate content, and deliver for one subscription row."""
        profile = sub.get("user_profiles") or {}
        user_id = profile.get("id") or sub.get("user_id")
        if not user_id:
            return False

        try:
            ctx: Optional[PersonaContext] = await build_context(user_id)
            if not ctx:
                logger.warning("Could not build context for user_id=%s — skipping", user_id)
                return False

            content_md = generate_alert(ctx, alert_type)
            channels   = self._channels_from_profile(profile)

            await deliver_alert(
                ctx=ctx,
                alert_type=alert_type,
                content_md=content_md,
                channels=channels,
                sub_id=sub.get("id"),
                to_email=profile.get("email"),
                to_phone=profile.get("phone"),
            )
            return True
        except Exception as e:
            logger.error("Alert send failed for user_id=%s, type=%s: %s", user_id, alert_type, e)
            return False

    # ------------------------------------------------------------------
    # Public run methods (called by Celery tasks)
    # ------------------------------------------------------------------

    async def check_threshold_breaches(self) -> Dict[str, int]:
        """
        Called after every ingestion cycle from realtime_pipeline.

        Queries all users with an active 'threshold_breach' subscription whose
        current PM2.5 exceeds their alert_threshold_pm25.  Generates and
        delivers a REALTIME_THRESHOLD / COMMUNITY_THRESHOLD / WARD_CRITICAL
        alert (depending on persona).

        Returns a count dict: {sent, skipped}.
        """
        subs = await self._load_subscriptions("threshold_breach")
        sent = skipped = 0

        for sub in subs:
            profile   = sub.get("user_profiles") or {}
            threshold = float(profile.get("alert_threshold_pm25") or 100.0)
            user_id   = profile.get("id") or sub.get("user_id")

            # Quick check: peek at current avg PM2.5 before spending LLM tokens
            try:
                from backend.app.services.supabase import get_supabase
                supabase = get_supabase()
                city = profile.get("default_city", "Delhi")
                recent = (
                    supabase.table("measurements")
                    .select("pm25")
                    .eq("city", city)
                    .order("measured_at", desc=True)
                    .limit(5)
                    .execute()
                )
                vals = [r["pm25"] for r in (recent.data or []) if r.get("pm25")]
                current_pm25 = sum(vals) / len(vals) if vals else 0.0
            except Exception:
                current_pm25 = threshold + 1  # conservative: assume breach

            if current_pm25 < threshold:
                skipped += 1
                continue

            # Determine threshold alert type from persona
            from .personas import Persona
            persona_val = profile.get("persona", "individual")
            try:
                persona = Persona(persona_val)
            except ValueError:
                persona = Persona.INDIVIDUAL
            alert_type = DEFAULT_THRESHOLD_ALERT[persona]

            ok = await self._send_to_subscription(sub, alert_type)
            sent += 1 if ok else 0

        logger.info(
            "Threshold check complete — subs=%d sent=%d skipped=%d",
            len(subs), sent, skipped,
        )
        return {"sent": sent, "skipped": skipped}

    async def run_daily_summaries(self) -> Dict[str, int]:
        """
        Called every day at 02:30 UTC (08:00 IST) by Celery Beat.

        Delivers DAILY_SUMMARY to individuals and CITY_DASHBOARD to
        municipality users with an active 'daily_summary' subscription.
        """
        subs = await self._load_subscriptions("daily_summary")
        sent = skipped = 0

        for sub in subs:
            profile = sub.get("user_profiles") or {}
            persona_val = profile.get("persona", "individual")
            try:
                from .personas import Persona
                persona = Persona(persona_val)
            except ValueError:
                persona = Persona.INDIVIDUAL

            alert_type_map = {
                Persona.INDIVIDUAL:   AlertType.DAILY_SUMMARY,
                Persona.COMMUNITY:    AlertType.WEEKLY_DIGEST,   # communities get daily as digest
                Persona.MUNICIPALITY: AlertType.CITY_DASHBOARD,
            }
            alert_type = alert_type_map.get(persona, AlertType.DAILY_SUMMARY)

            ok = await self._send_to_subscription(sub, alert_type)
            sent += 1 if ok else 0
            if not ok:
                skipped += 1

        logger.info("Daily summaries — sent=%d skipped=%d", sent, skipped)
        return {"sent": sent, "skipped": skipped}

    async def run_weekly_plans(self) -> Dict[str, int]:
        """
        Called every Monday at 02:30 UTC by Celery Beat.

        Delivers WEEKLY_PLAN / WEEKLY_DIGEST / WEEKLY_POLICY_BRIEF by persona.
        """
        subs = await self._load_subscriptions("weekly_plan")
        sent = skipped = 0

        for sub in subs:
            profile = sub.get("user_profiles") or {}
            persona_val = profile.get("persona", "individual")
            try:
                from .personas import Persona
                persona = Persona(persona_val)
            except ValueError:
                persona = Persona.INDIVIDUAL

            alert_type_map = {
                Persona.INDIVIDUAL:   AlertType.WEEKLY_PLAN,
                Persona.COMMUNITY:    AlertType.WEEKLY_DIGEST,
                Persona.MUNICIPALITY: AlertType.WEEKLY_POLICY_BRIEF,
            }
            alert_type = alert_type_map.get(persona, AlertType.WEEKLY_PLAN)

            ok = await self._send_to_subscription(sub, alert_type)
            sent += 1 if ok else 0
            if not ok:
                skipped += 1

        logger.info("Weekly plans — sent=%d skipped=%d", sent, skipped)
        return {"sent": sent, "skipped": skipped}

    async def run_monthly_reports(self) -> Dict[str, int]:
        """
        Called on the 1st of each month at 03:00 UTC by Celery Beat.

        Delivers MONTHLY_HEALTH_PLAN / MONTHLY_REGULATORY by persona.
        """
        subs = await self._load_subscriptions("monthly_report")
        sent = skipped = 0

        for sub in subs:
            profile = sub.get("user_profiles") or {}
            persona_val = profile.get("persona", "individual")
            try:
                from .personas import Persona
                persona = Persona(persona_val)
            except ValueError:
                persona = Persona.INDIVIDUAL

            alert_type_map = {
                Persona.INDIVIDUAL:   AlertType.WEEKLY_PLAN,         # individuals: weekly is deepest
                Persona.COMMUNITY:    AlertType.MONTHLY_HEALTH_PLAN,
                Persona.MUNICIPALITY: AlertType.MONTHLY_REGULATORY,
            }
            alert_type = alert_type_map.get(persona, AlertType.MONTHLY_HEALTH_PLAN)

            ok = await self._send_to_subscription(sub, alert_type)
            sent += 1 if ok else 0
            if not ok:
                skipped += 1

        logger.info("Monthly reports — sent=%d skipped=%d", sent, skipped)
        return {"sent": sent, "skipped": skipped}


# ---------------------------------------------------------------------------
# Module-level singleton (imported by Celery tasks)
# ---------------------------------------------------------------------------

scheduler = AlertScheduler()
