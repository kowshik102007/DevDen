"""
Intelligent routing (Phase 10).

Picks the best model/provider for a request from the user's *enabled catalog*,
using the capability metadata we already collect (coding_score, speed_score,
vision_support, reasoning_support, context_window).

This is deterministic and instant — a cheap heuristic task profile derived from
the messages, scored against each candidate model. No extra LLM call. The result
is an *ordered* list of (model_id, provider_id, reason): the first entry is the
pick, the rest form the failover order for this single request.

Used when the caller selects the sentinel model `"auto"`. When the catalog is
empty or scoring can't decide, callers fall back to their existing default
model + priority-ordered failover (this module returns an empty list).
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.provider import Provider
from app.services.catalog_service import get_catalog

AUTO_MODEL = "auto"

# Rough chars-per-token; only used to bucket "is this a long context?"
_CHARS_PER_TOKEN = 4
_LONG_CONTEXT_TOKENS = 6_000

_CODE_HINT = re.compile(r"```|\b(code|function|bug|stack ?trace|compile|refactor|"
                        r"regex|api|sql|python|javascript|typescript|rust|java|c\+\+|"
                        r"docker|kubernetes|terraform)\b", re.IGNORECASE)
_REASON_HINT = re.compile(r"\b(why|prove|reason|step[- ]by[- ]step|analy[sz]e|"
                          r"derive|explain how|plan|strategy|trade[- ]?off|"
                          r"compare|evaluate)\b", re.IGNORECASE)


def is_auto(model: str | None) -> bool:
    return (model or "").strip().lower() == AUTO_MODEL


# --------------------------------------------------------------------------- #
# Task profile                                                                 #
# --------------------------------------------------------------------------- #

def _profile(messages: list[dict], has_image: bool) -> dict:
    """Cheap heuristic profile of what the request needs."""
    text_len = 0
    last_user = ""
    for m in messages:
        content = m.get("content")
        if isinstance(content, str):
            text_len += len(content)
            if m.get("role") == "user":
                last_user = content
        elif isinstance(content, list):
            # multimodal content parts
            for part in content:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    text_len += len(part["text"])
                    if m.get("role") == "user":
                        last_user = part["text"]

    est_tokens = text_len // _CHARS_PER_TOKEN
    return {
        "needs_vision": has_image,
        "needs_long_context": est_tokens > _LONG_CONTEXT_TOKENS,
        "est_tokens": est_tokens,
        "is_coding": bool(_CODE_HINT.search(last_user)),
        "is_reasoning": bool(_REASON_HINT.search(last_user)),
    }


# --------------------------------------------------------------------------- #
# Scoring                                                                      #
# --------------------------------------------------------------------------- #

def _score(entry, profile: dict, routing_mode: str = "balanced") -> tuple[float, list[str]]:
    """Return (score, reasons) for a catalog entry against the task profile.

    Returns score < 0 to mean "hard-disqualified"."""
    coding = entry.coding_score or 5
    speed = entry.speed_score or 5
    knowledge = entry.knowledge_score or 5
    reliability = entry.reliability_score
    ctx = entry.context_window or 8_000
    reasons: list[str] = []

    if profile["needs_vision"] and not entry.vision_support:
        return -1.0, ["no vision support"]

    needed_ctx = profile["est_tokens"] + 1_000
    if profile["needs_long_context"] and ctx < needed_ctx:
        return -1.0, [f"context too small ({ctx} < ~{needed_ctx})"]

    score = 0.0

    # --- Reliability mode: override normal scoring ---
    if routing_mode == "reliability":
        if reliability is not None:
            score += reliability * 3.0
            if reliability >= 8:
                score += 4.0
            reasons.append(f"reliable ({reliability}/10)")
        else:
            score -= 5.0
            reasons.append("no data")
        score += (coding + knowledge + speed) * 0.15
        return score, reasons

    # --- Mode weight multipliers ---
    if routing_mode == "speed":
        w_speed, w_know, w_code = 2.0, 0.2, 1.0
        w_reason_know, w_reason_bonus = 0.8, 2.5
    elif routing_mode == "quality":
        w_speed, w_know, w_code = 0.3, 1.5, 2.0
        w_reason_know, w_reason_bonus = 2.0, 7.5
    else:  # balanced
        w_speed, w_know, w_code = 1.2, 0.5, 1.5
        w_reason_know, w_reason_bonus = 1.2, 5.0

    if profile["needs_vision"]:
        score += 6.0
        reasons.append("vision")

    if profile["is_coding"]:
        score += coding * w_code + knowledge * w_know
        reasons.append(f"coding {coding}/10")

    if profile["is_reasoning"]:
        score += knowledge * w_reason_know
        if entry.reasoning_support:
            score += w_reason_bonus
            reasons.append("reasoning model")
        else:
            reasons.append(f"knowledge {knowledge}/10")

    if profile["needs_long_context"]:
        ctx_bucket = min(ctx // 32_000, 8)
        score += ctx_bucket * 1.5
        reasons.append(f"{ctx // 1000}k ctx")

    is_task = (profile["is_coding"] or profile["is_reasoning"]
               or profile["needs_vision"] or profile["needs_long_context"])
    if not is_task:
        score += speed * w_speed + knowledge * w_know
        reasons.append(f"fast ({speed}/10)")
    else:
        score += speed * 0.3

    if reliability is not None:
        if reliability <= 3:
            score *= 0.5
            reasons.append(f"unreliable ({reliability}/10)")
        elif reliability <= 6:
            score *= 0.8

    return score, reasons


def _provider_health(db: Session, user_id: UUID) -> dict[str, Provider]:
    """Load all enabled providers keyed by str(id) for health checks."""
    return {
        str(p.id): p
        for p in db.query(Provider).filter(
            Provider.user_id == user_id, Provider.enabled == True
        ).all()
    }


def _health_penalty(provider: Provider | None) -> tuple[float, str | None]:
    """Return (penalty, reason) based on live provider health.

    Penalty is subtracted from the model score. A very large penalty
    effectively pushes the model to the bottom of the failover order."""
    if provider is None:
        return 100.0, "provider missing"

    if provider.circuit_state == "open":
        if provider.cooldown_until and datetime.utcnow() < provider.cooldown_until:
            return 50.0, "circuit open"

    if provider.status == "rate_limited":
        return 20.0, "rate limited"

    failures = provider.consecutive_failures or 0
    if failures >= 3:
        return 30.0, f"{failures} consecutive failures"
    if failures > 0:
        if provider.last_error_at and (datetime.utcnow() - provider.last_error_at) < timedelta(minutes=2):
            return failures * 8.0, "recent failure"

    return 0.0, None


def choose_models(
    db: Session,
    user_id: UUID,
    messages: list[dict],
    has_image: bool = False,
    preferred_provider_id: str | None = None,
    routing_mode: str = "balanced",
) -> list[tuple[str, str, str]]:
    """Return an ordered list of (model_id, provider_id, reason).

    First entry = the pick; remaining = failover order for this request.
    Empty list means "can't decide" — caller should use its normal default."""
    catalog = get_catalog(db, user_id)
    if not catalog:
        return []

    profile = _profile(messages, has_image)
    providers = _provider_health(db, user_id)

    scored: list[tuple[float, list[str], object]] = []
    for e in catalog:
        prov = providers.get(str(e.provider_id))
        if prov is None:
            continue

        s, reasons = _score(e, profile, routing_mode)
        if s < 0:
            continue

        penalty, penalty_reason = _health_penalty(prov)
        if penalty > 0:
            s -= penalty
            if penalty_reason:
                reasons.append(penalty_reason)

        scored.append((s, reasons, e))

    if not scored:
        return []

    def sort_key(item):
        s, _reasons, e = item
        pref = 0 if (preferred_provider_id and str(e.provider_id) == preferred_provider_id) else 1
        return (-s, pref, e.provider_name or "", e.model_id)

    scored.sort(key=sort_key)

    out: list[tuple[str, str, str]] = []
    for s, reasons, e in scored:
        reason = ", ".join(reasons) if reasons else "general"
        out.append((e.model_id, str(e.provider_id), reason))
    return out


def describe_profile(messages: list[dict], has_image: bool = False) -> str:
    """Human-readable summary of the detected task profile (for logs/UI)."""
    p = _profile(messages, has_image)
    tags = []
    if p["needs_vision"]:
        tags.append("vision")
    if p["is_coding"]:
        tags.append("coding")
    if p["is_reasoning"]:
        tags.append("reasoning")
    if p["needs_long_context"]:
        tags.append(f"long-context (~{p['est_tokens']}tok)")
    return ", ".join(tags) or "general"
