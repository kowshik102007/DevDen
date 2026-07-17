"""
Multi-Channel Alert Delivery
==============================
Delivers a generated alert message through one or more channels and
records the outcome in the `alert_deliveries` Supabase table.

Supported channels
------------------
  log        — always active; writes to Python logger
  webhook    — POST JSON to ALERT_WEBHOOK_URL environment variable
  email      — SendGrid if SENDGRID_API_KEY is configured
  sms        — Twilio SMS if TWILIO_* credentials are configured
  whatsapp   — Twilio WhatsApp if TWILIO_WHATSAPP_FROM is configured

All external channels are optional / gracefully skipped when not configured.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx

from .personas import Persona, PersonaContext
from .generators import AlertType

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate_sms(text: str, max_chars: int = 1600) -> str:
    """Strip Markdown and truncate to SMS-safe length."""
    import re
    plain = re.sub(r"[#*_`>~\[\]()!]", "", text)
    plain = re.sub(r"\n{3,}", "\n\n", plain).strip()
    return plain[:max_chars]


# ---------------------------------------------------------------------------
# Individual channel implementations
# ---------------------------------------------------------------------------

async def _send_webhook(
    ctx: PersonaContext,
    alert_type: AlertType,
    content_md: str,
) -> bool:
    url = os.environ.get("ALERT_WEBHOOK_URL")
    if not url:
        return False
    payload = {
        "user_id": ctx.user_id,
        "persona": ctx.persona.value,
        "alert_type": alert_type.value,
        "locality": ctx.locality,
        "city": ctx.city,
        "pm25": ctx.stats.avg_pm25,
        "severity": ctx.stats.severity,
        "trend": ctx.stats.trend,
        "content_md": content_md,
        "timestamp": _now_iso(),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        logger.debug("Webhook delivered to %s — status %s", url, resp.status_code)
        return True
    except Exception as e:
        logger.warning("Webhook delivery failed: %s", e)
        return False


async def _send_email(
    to_email: str,
    name: str,
    subject: str,
    content_md: str,
) -> bool:
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        return False
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Content
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        from_email = os.environ.get("SENDGRID_FROM_EMAIL", "alerts@podscout.in")
        # Convert Markdown to simple HTML paragraphs
        html = content_md.replace("\n\n", "</p><p>").replace("\n", "<br>")
        html = f"<p>{html}</p>"
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=html,
        )
        sg.send(message)
        logger.debug("Email delivered to %s", to_email)
        return True
    except ImportError:
        logger.debug("sendgrid package not installed — skipping email")
        return False
    except Exception as e:
        logger.warning("Email delivery failed for %s: %s", to_email, e)
        return False


async def _send_sms(to_phone: str, content_md: str) -> bool:
    sid   = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_ = os.environ.get("TWILIO_FROM_PHONE")
    if not all([sid, token, from_]):
        return False
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        client.messages.create(
            body=_truncate_sms(content_md, 1600),
            from_=from_,
            to=to_phone,
        )
        logger.debug("SMS delivered to %s", to_phone)
        return True
    except ImportError:
        logger.debug("twilio package not installed — skipping SMS")
        return False
    except Exception as e:
        logger.warning("SMS delivery failed for %s: %s", to_phone, e)
        return False


async def _send_whatsapp(to_phone: str, content_md: str) -> bool:
    sid       = os.environ.get("TWILIO_ACCOUNT_SID")
    token     = os.environ.get("TWILIO_AUTH_TOKEN")
    from_     = os.environ.get("TWILIO_WHATSAPP_FROM")
    if not all([sid, token, from_]):
        return False
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        wa_to   = f"whatsapp:{to_phone}" if not to_phone.startswith("whatsapp:") else to_phone
        wa_from = f"whatsapp:{from_}"    if not from_.startswith("whatsapp:")    else from_
        client.messages.create(
            body=_truncate_sms(content_md, 4096),
            from_=wa_from,
            to=wa_to,
        )
        logger.debug("WhatsApp delivered to %s", to_phone)
        return True
    except ImportError:
        logger.debug("twilio package not installed — skipping WhatsApp")
        return False
    except Exception as e:
        logger.warning("WhatsApp delivery failed for %s: %s", to_phone, e)
        return False


# ---------------------------------------------------------------------------
# Persist delivery record
# ---------------------------------------------------------------------------

async def _record_delivery(
    ctx: PersonaContext,
    alert_type: AlertType,
    channel: str,
    content_md: str,
    sub_id: Optional[str],
    status: str,
) -> None:
    try:
        from backend.app.services.supabase import get_supabase
        supabase = get_supabase()
        if not supabase:
            return
        subject = f"PodScout Alert: {ctx.locality} — {alert_type.value.replace('_', ' ').title()}"
        supabase.table("alert_deliveries").insert({
            "id":           str(uuid4()),
            "user_id":      ctx.user_id,
            "sub_id":       sub_id,
            "persona":      ctx.persona.value,
            "alert_type":   alert_type.value,
            "channel":      channel,
            "subject":      subject,
            "content_md":   content_md,
            "locality":     ctx.locality,
            "city":         ctx.city,
            "pm25_at_send": ctx.stats.avg_pm25,
            "severity":     ctx.stats.severity,
            "status":       status,
            "sent_at":      _now_iso(),
        }).execute()
    except Exception as e:
        logger.warning("Failed to record delivery: %s", e)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def deliver_alert(
    ctx: PersonaContext,
    alert_type: AlertType,
    content_md: str,
    channels: List[str],
    sub_id: Optional[str] = None,
    to_email: Optional[str] = None,
    to_phone: Optional[str] = None,
) -> Dict[str, bool]:
    """
    Deliver ``content_md`` through each requested channel.

    Parameters
    ----------
    ctx          : PersonaContext for the recipient
    alert_type   : alert type label (for record-keeping)
    content_md   : generated alert text in Markdown
    channels     : list of channel names to use, e.g. ["log", "email", "whatsapp"]
    sub_id       : optional subscription ID for audit trail
    to_email     : recipient email (required for "email" channel)
    to_phone     : recipient phone in E.164 format (required for sms/whatsapp)

    Returns
    -------
    dict mapping each channel to True (success) / False (failure/skipped)
    """
    results: Dict[str, bool] = {}
    subject = (
        f"PodScout Alert: {ctx.locality} — {alert_type.value.replace('_', ' ').title()}"
    )

    for channel in channels:
        ok = False
        try:
            if channel == "log":
                logger.info(
                    "ALERT [%s | %s | %s] pm25=%.1f  %s",
                    ctx.persona.value, alert_type.value, ctx.locality,
                    ctx.stats.avg_pm25, ctx.stats.severity,
                )
                ok = True

            elif channel == "webhook":
                ok = await _send_webhook(ctx, alert_type, content_md)

            elif channel == "email":
                if to_email:
                    ok = await _send_email(to_email, ctx.name, subject, content_md)
                else:
                    logger.debug("Email channel requested but no to_email provided — skipping")

            elif channel == "sms":
                if to_phone:
                    ok = await _send_sms(to_phone, content_md)
                else:
                    logger.debug("SMS channel requested but no to_phone provided — skipping")

            elif channel == "whatsapp":
                if to_phone:
                    ok = await _send_whatsapp(to_phone, content_md)
                else:
                    logger.debug("WhatsApp channel requested but no to_phone provided — skipping")

            else:
                logger.warning("Unknown delivery channel: %r", channel)

        except Exception as e:
            logger.error("Unexpected error on channel %r: %s", channel, e)

        results[channel] = ok
        await _record_delivery(
            ctx=ctx,
            alert_type=alert_type,
            channel=channel,
            content_md=content_md,
            sub_id=sub_id,
            status="delivered" if ok else "failed",
        )

    return results
