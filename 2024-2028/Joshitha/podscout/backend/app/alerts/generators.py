"""
Persona-Aware Alert Generators
================================
Generates LLM-powered, locality-specific alert content for every
(persona × alert_type) combination.

Personas × Alert Types
-----------------------
INDIVIDUAL   × realtime_threshold  — PM2.5 just crossed personal threshold
             × daily_summary       — 8 am morning brief
             × weekly_plan         — Monday week-ahead plan

COMMUNITY    × community_threshold — Ward/neighbourhood critical breach
             × weekly_digest       — Community newsletter
             × monthly_health_plan — Monthly community health plan

MUNICIPALITY × ward_critical       — Emergency ward briefing (immediate)
             × city_dashboard      — 8 am executive overview
             × weekly_policy_brief — Policy intelligence brief
             × monthly_regulatory  — CPCB compliance report

LLM routing:  Groq (Mixtral)  → fast, real-time alerts
              Gemini 2.0 Flash → longer strategic / policy content
              Auto-fallback if primary provider fails.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Callable, Tuple

from .personas import Persona, PersonaContext

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Alert type catalogue
# ---------------------------------------------------------------------------

class AlertType(str, Enum):
    # Individual
    REALTIME_THRESHOLD  = "realtime_threshold"
    DAILY_SUMMARY       = "daily_summary"
    WEEKLY_PLAN         = "weekly_plan"
    # Community
    COMMUNITY_THRESHOLD = "community_threshold"
    WEEKLY_DIGEST       = "weekly_digest"
    MONTHLY_HEALTH_PLAN = "monthly_health_plan"
    # Municipality
    WARD_CRITICAL       = "ward_critical"
    CITY_DASHBOARD      = "city_dashboard"
    WEEKLY_POLICY_BRIEF = "weekly_policy_brief"
    MONTHLY_REGULATORY  = "monthly_regulatory_report"


# ---------------------------------------------------------------------------
# Prompt builders — one function per (persona, alert_type)
# ---------------------------------------------------------------------------

def _individual_threshold(ctx: PersonaContext) -> str:
    s = ctx.stats
    health      = ctx.extra.get("health_conditions", ["none"])
    children    = ctx.extra.get("children_present", False)
    outdoor_job = ctx.extra.get("outdoor_job", False)
    level       = "CRITICAL" if s.avg_pm25 >= 150 else "HIGH" if s.avg_pm25 >= 100 else "ELEVATED"

    return f"""You are PodScout, a caring air quality assistant for Indian cities.
Generate a PERSONALISED HEALTH ALERT for a user.

CONTEXT:
- Name: {ctx.name}
- Location: {ctx.locality}, {ctx.city}
- Current PM2.5: {s.avg_pm25} µg/m³  (their set threshold: {ctx.threshold_pm25} µg/m³)
- Alert level: {level}
- Nearby stations — critical (≥150): {s.critical_sites} / total: {s.num_sites}
- Trend: {s.trend}  |  24-h forecast: {s.forecast_24h if s.forecast_24h else "unavailable"} µg/m³

HEALTH PROFILE:
- Medical conditions: {", ".join(health) if isinstance(health, list) else health}
- Children at home: {"Yes" if children else "No"}
- Works outdoors: {"Yes" if outdoor_job else "No"}

INSTRUCTIONS:
Write the alert in {ctx.language}. Include exactly:
1. **Bold headline** — one line, states what's happening and where.
2. Health risk paragraph — tailored to their specific conditions, mention children if present.
3. Three immediate actions — numbered, specific, doable right now.
4. When conditions may improve — based on trend (be honest if unknown).
5. One supportive closing sentence.

Rules: Under 220 words. Markdown formatting. Caring tone — NOT alarmist."""


def _individual_daily(ctx: PersonaContext) -> str:
    s = ctx.stats
    health = ctx.extra.get("health_conditions", ["general health"])

    return f"""You are PodScout, a friendly morning air quality companion.
Generate a DAILY MORNING BRIEF for a user.

CONTEXT:
- Name: {ctx.name}
- Location: {ctx.locality}, {ctx.city}
- Today's PM2.5: {s.avg_pm25} µg/m³  (threshold: {ctx.threshold_pm25})
- Severity: {s.severity}
- Trend: {s.trend}
- Today's forecast: {s.forecast_24h if s.forecast_24h else "data pending"} µg/m³
- Health conditions: {", ".join(health) if isinstance(health, list) else health}
- Language: {ctx.language}

INSTRUCTIONS:
Write the morning brief in {ctx.language}. Include:
1. Good morning greeting with a status emoji (✅ Good / 🟡 Moderate / 🟠 Poor / 🔴 Critical).
2. One-sentence situation summary personalised to their health conditions.
3. A 3-row forecast table: Morning | Afternoon | Evening — advice for each period.
4. "Best outdoor window" — specific time today for the safest outdoor activity.
5. Mask needed? — Yes / Optional / No, with a one-line reason.
6. One personalised health tip for their conditions.

Rules: Under 200 words. Warm, conversational tone — like a trusted friend texting them."""


def _individual_weekly(ctx: PersonaContext) -> str:
    s = ctx.stats
    health   = ctx.extra.get("health_conditions", ["none"])
    children = ctx.extra.get("children_present", False)

    return f"""You are PodScout, a weekly wellness guide for urban residents.
Generate a PERSONALISED WEEK-AHEAD AIR QUALITY PLAN.

CONTEXT:
- Name: {ctx.name}
- Location: {ctx.locality}, {ctx.city}
- This week's avg PM2.5: {s.avg_pm25} µg/m³
- Trend vs last week: {s.trend}
- Health conditions: {", ".join(health) if isinstance(health, list) else health}
- Children at home: {"Yes" if children else "No"}
- Language: {ctx.language}

INSTRUCTIONS:
Write the plan in {ctx.language}. Include:
1. **Week Summary** — one sentence rating this week's air quality.
2. **Risk Days / Times** — which days or times to most avoid outdoor activity.
3. **Protective Habits** — 5 actionable habits for the week (mask, purifier, ventilation, plants, diet).
4. **Children's Advice** — {"School/play advisory tailored to children's exposure" if children else "N/A — skip this section"}.
5. **Exposure Context** — is this week's exposure better or worse than typical, and what it means over time.
6. **Bright Spot** — one nearby park, route, or time-window with cleaner air.

Rules: Under 280 words. Friendly, practical, empowering tone."""


def _community_threshold(ctx: PersonaContext) -> str:
    s          = ctx.stats
    org        = ctx.extra.get("org_name", f"{ctx.locality} Community")
    members    = ctx.extra.get("member_count", "residents")
    has_school = ctx.extra.get("has_school", False)

    return f"""You are PodScout, a community air quality advisor.
Generate a COMMUNITY ALERT BULLETIN.

CONTEXT:
- Organisation: {org}
- Area: {ctx.locality}, {ctx.city}
- Members / residents: {members}
- Current average PM2.5: {s.avg_pm25} µg/m³
- Critical stations (≥150): {s.critical_sites} / {s.num_sites}
- High stations (100–149): {s.high_sites} / {s.num_sites}
- Trend: {s.trend}
- School nearby: {"Yes" if has_school else "No"}
- Language: {ctx.language}

INSTRUCTIONS:
Write the bulletin in {ctx.language}. Include:
1. **Alert header** — bold, location-specific, clear severity.
2. **Situation** — 2 sentences on what's happening in the neighbourhood.
3. **Most at risk** — specific groups: elderly, children, outdoor workers.
4. **Community action checklist** — 5 things the community can do collectively TODAY.
5. **{"School advisory" if has_school else "Children's advisory"}** — concrete guidance.
6. **Share this** — a ready-to-copy WhatsApp / SMS message, under 100 words, in the same language.

Rules: Under 300 words. Calm, collective, empowering — NOT panic-inducing."""


def _community_weekly(ctx: PersonaContext) -> str:
    s           = ctx.stats
    org         = ctx.extra.get("org_name", f"{ctx.locality} Community")
    meeting_day = ctx.extra.get("meeting_day", "")
    has_school  = ctx.extra.get("has_school", False)

    return f"""You are PodScout, a community environmental advisor.
Generate a WEEKLY COMMUNITY DIGEST.

CONTEXT:
- Organisation: {org}
- Area: {ctx.locality}, {ctx.city}
- Week avg PM2.5: {s.avg_pm25} µg/m³
- Worst spots: {s.critical_sites} sites above 150 µg/m³
- Trend: {s.trend}
- School in area: {"Yes" if has_school else "No"}
- Community meeting day: {meeting_day if meeting_day else "not specified"}
- Language: {ctx.language}

INSTRUCTIONS:
Write the weekly digest in {ctx.language}. Include:
1. **Week in Review** — 2 sentences: was it better/worse than last week?
2. **Top 3 Concern Areas** — most polluted spots/times in the neighbourhood.
3. **{"School AQI Review" if has_school else "Children's Outdoor Play"}** — safety assessment and timing advice.
4. **Community Actions** — 3 things the community can collectively do this week.
5. {"**Meeting Agenda Points** — 2 air quality agenda items for the upcoming " + meeting_day + " meeting." if meeting_day else "**Advocacy Prompt** — one specific request to make to the local municipality."}
6. **Positive Note** — one improvement or win to celebrate.

Rules: Under 300 words. Newsletter tone — informative, community-spirited."""


def _community_monthly(ctx: PersonaContext) -> str:
    s   = ctx.stats
    org = ctx.extra.get("org_name", f"{ctx.locality} Community")

    return f"""You are PodScout, a community health strategist.
Generate a MONTHLY COMMUNITY HEALTH PLAN.

CONTEXT:
- Organisation: {org}
- Area: {ctx.locality}, {ctx.city}
- This month avg PM2.5: {s.avg_pm25} µg/m³
- Trend: {s.trend}
- Language: {ctx.language}

INSTRUCTIONS:
Write the monthly health plan in {ctx.language}. Include:
1. **Monthly Health Summary** — key stats and real health implications for community members.
2. **Seasonal Context** — what to expect next month (weather + pollution patterns in Indian climate).
3. **Indoor Air Quality** — practical tips for homes, offices, community halls.
4. **Vulnerable Members** — targeted practical advice for elderly, children, pregnant women.
5. **Green Community Initiatives** — 3 realistic projects to improve local air (trees, EV, carpooling).
6. **Escalation Path** — when and how to formally report to municipality / CPCB / SAFAR.

Rules: Under 350 words. Empowering, solutions-focused, community-owned tone."""


def _municipality_ward_critical(ctx: PersonaContext) -> str:
    s          = ctx.stats
    population = ctx.extra.get("population", 0)
    at_risk    = int(population * 0.35) if population else "significant portion"
    ward       = ctx.extra.get("ward_name", ctx.locality)
    sensors    = ctx.extra.get("num_sensors", s.num_sites)
    naaqs_ratio = round(s.avg_pm25 / 60, 1)

    return f"""You are an environmental intelligence system reporting to municipal authorities.
Generate a MUNICIPAL EMERGENCY BRIEFING — formal government format.

INCIDENT DATA:
- Jurisdiction: {ward}, {ctx.city}
- Current PM2.5: {s.avg_pm25} µg/m³
- India NAAQS 24-h standard: 60 µg/m³  →  current reading is {naaqs_ratio}× the limit
- Critical sites (≥150 µg/m³): {s.critical_sites} / {s.num_sites}
- High sites (100–149 µg/m³): {s.high_sites} / {s.num_sites}
- Trend: {s.trend}
- Population: {population:,} if {population} else "data pending"
- Estimated at-risk residents: {at_risk:,} if {population} else "to be estimated"
- Active sensors covering ward: {sensors}

INSTRUCTIONS:
Produce the formal briefing in English:
1. **SITUATION SUMMARY** — 2 sentences, fully quantified.
2. **REGULATORY STATUS** — which NAAQS standards are violated, by how much.
3. **POPULATION IMPACT** — breakdown by category (elderly / children / general).
4. **IMMEDIATE RESPONSE ACTIONS** — 5 numbered actions with responsible department assigned.
5. **MONITORING GAPS** — ward areas with no sensor coverage.
6. **PUBLIC ADVISORY TEMPLATE** — 50-word public notice ready to publish.
7. **ESCALATION TRIGGER** — conditions that require escalating to state/central authority.

Rules: Under 450 words. Formal government language. Cite NAAQS and CPCB standards."""


def _municipality_city_dashboard(ctx: PersonaContext) -> str:
    s          = ctx.stats
    population = ctx.extra.get("population", "")

    return f"""You are an environmental intelligence system.
Generate a DAILY CITY AIR QUALITY DASHBOARD BRIEF for the municipal authority of {ctx.city}.

MORNING DATA:
- Total active monitoring stations: {s.num_sites}
- City average PM2.5: {s.avg_pm25} µg/m³  (NAAQS 24-h limit: 60 µg/m³)
- Critical zones (≥150): {s.critical_sites}
- High zones (100–149): {s.high_sites}
- Trend: {s.trend}
- 24-h forecast: {s.forecast_24h if s.forecast_24h else "unavailable"} µg/m³
- City population: {f"{population:,}" if isinstance(population, int) else population or "data pending"}

INSTRUCTIONS:
Generate the morning dashboard brief:
1. **City Status** — one line with colour code: 🔴 Emergency / 🟠 Alert / 🟡 Moderate / 🟢 Good
2. **Top 5 Critical Wards** — list with PM2.5 values (use available data or flag as "sensor gap").
3. **Today's Priority Actions** — 3 specific departmental actions for today with owner assigned.
4. **Resource Status** — Climate Pods / response teams needed vs estimated available.
5. **Forecast Advisory** — will the situation improve or worsen by this evening?
6. **Metrics Table** — three rows: PM2.5 | PM10 | NO2, columns: Today's avg | NAAQS limit | Status ✅/❌

Rules: Under 350 words. Executive dashboard format — scannable, data-first."""


def _municipality_weekly_policy(ctx: PersonaContext) -> str:
    s          = ctx.stats
    population = ctx.extra.get("population", "")
    budget     = ctx.extra.get("budget_crore", "")

    return f"""You are an environmental intelligence analyst.
Generate a WEEKLY POLICY INTELLIGENCE BRIEF for the environment team of {ctx.city}.

WEEK DATA:
- City average PM2.5: {s.avg_pm25} µg/m³
- Trend vs last week: {s.trend}
- Critical sites: {s.critical_sites} | High sites: {s.high_sites} | Total monitored: {s.num_sites}
- City population: {f"{population:,}" if isinstance(population, int) else population or "data pending"}
- Environment budget: {f"₹{budget} Cr" if budget else "data pending"}

INSTRUCTIONS:
Generate the weekly policy brief in English:
1. **Executive Summary** — 3 sentences: week performance, compliance status, notable events.
2. **Trend Analysis** — week-on-week change and seasonal context.
3. **Neighbourhood Rankings** — best and worst performing wards this week.
4. **NAAQS Compliance** — % of station-days within the 60 µg/m³ 24-h standard.
5. **Policy Recommendations** — 5 evidence-based medium-term actions (with implementing body).
6. **Sensor Network Status** — coverage gaps, maintenance backlogs.
7. **Climate Pod ROI** — if pods are deployed, estimated PM2.5 reduction achieved this week.
8. **Next Week Outlook** — forecast and recommended pre-emptive actions.

Rules: Under 500 words. Formal policy document format."""


def _municipality_monthly_regulatory(ctx: PersonaContext) -> str:
    s = ctx.stats

    return f"""You are an environmental compliance analyst.
Generate a MONTHLY REGULATORY COMPLIANCE REPORT for {ctx.city} (CPCB / SAFAR format).

MONTH DATA:
- City average PM2.5: {s.avg_pm25} µg/m³  (NAAQS annual: 40 µg/m³)
- Monitoring stations active: {s.num_sites}
- Sites with critical exceedances (≥150 µg/m³): {s.critical_sites}
- Trend: {s.trend}

INSTRUCTIONS:
Generate the monthly compliance report in English:
1. **Compliance Summary Table** — PM2.5 / PM10 / NO2: monthly avg | NAAQS limit | Compliant ✅/❌
2. **Exceedance Analysis** — number and duration of NAAQS violations, worst sites.
3. **Health Burden Estimate** — estimated additional respiratory / cardiovascular events due to pollution.
4. **Infrastructure Review** — sensor coverage, downtime incidents, calibration status.
5. **Enforcement Actions** — recommended notices for non-compliant industrial / vehicular sources.
6. **Budget Allocation Recommendation** — priority areas for next month's intervention spend.
7. **Central Reporting Summary** — data extract ready for CPCB / SAFAR submission.

Rules: Under 600 words. Official regulatory format. Include references to NAAQS, CPCB standards."""


# ---------------------------------------------------------------------------
# Routing table  (persona, alert_type) → (prompt_fn, preferred_llm)
# ---------------------------------------------------------------------------

_PROMPT_MAP: dict[tuple, tuple[Callable, str]] = {
    (Persona.INDIVIDUAL,   AlertType.REALTIME_THRESHOLD):  (_individual_threshold,          "groq"),
    (Persona.INDIVIDUAL,   AlertType.DAILY_SUMMARY):       (_individual_daily,              "groq"),
    (Persona.INDIVIDUAL,   AlertType.WEEKLY_PLAN):         (_individual_weekly,             "gemini"),
    (Persona.COMMUNITY,    AlertType.COMMUNITY_THRESHOLD): (_community_threshold,           "groq"),
    (Persona.COMMUNITY,    AlertType.WEEKLY_DIGEST):       (_community_weekly,              "gemini"),
    (Persona.COMMUNITY,    AlertType.MONTHLY_HEALTH_PLAN): (_community_monthly,             "gemini"),
    (Persona.MUNICIPALITY, AlertType.WARD_CRITICAL):       (_municipality_ward_critical,    "groq"),
    (Persona.MUNICIPALITY, AlertType.CITY_DASHBOARD):      (_municipality_city_dashboard,   "groq"),
    (Persona.MUNICIPALITY, AlertType.WEEKLY_POLICY_BRIEF): (_municipality_weekly_policy,    "gemini"),
    (Persona.MUNICIPALITY, AlertType.MONTHLY_REGULATORY):  (_municipality_monthly_regulatory, "gemini"),
}

# Which alert_type is the default threshold alert for each persona
DEFAULT_THRESHOLD_ALERT: dict[Persona, AlertType] = {
    Persona.INDIVIDUAL:   AlertType.REALTIME_THRESHOLD,
    Persona.COMMUNITY:    AlertType.COMMUNITY_THRESHOLD,
    Persona.MUNICIPALITY: AlertType.WARD_CRITICAL,
}


# ---------------------------------------------------------------------------
# Public generator
# ---------------------------------------------------------------------------

def generate_alert(ctx: PersonaContext, alert_type: AlertType) -> str:
    """
    Generate an LLM-powered, localised alert.

    Routes (persona, alert_type) → purpose-built prompt → Groq or Gemini.
    Automatically falls back to the other LLM if the primary fails.

    Returns a Markdown string ready for email / SMS / webhook delivery.
    """
    key = (ctx.persona, alert_type)
    if key not in _PROMPT_MAP:
        raise ValueError(
            f"No generator registered for persona={ctx.persona.value!r}, "
            f"alert_type={alert_type.value!r}"
        )

    prompt_fn, preferred = _PROMPT_MAP[key]
    prompt = prompt_fn(ctx)

    def _via_groq(p: str) -> str:
        from backend.app.llm.groq_client import GroqClient
        msgs = [
            {"role": "system", "content": "You are PodScout Pro, India's AI air quality platform."},
            {"role": "user",   "content": p},
        ]
        return GroqClient.chat_completion(msgs, temperature=0.4, max_tokens=1024)

    def _via_gemini(p: str) -> str:
        from backend.app.llm.gemini_client import GeminiClient
        return GeminiClient.generate_content(p, temperature=0.4, max_tokens=1024)

    primary, fallback = (_via_groq, _via_gemini) if preferred == "groq" else (_via_gemini, _via_groq)

    try:
        return primary(prompt)
    except Exception as e:
        logger.warning(f"Primary LLM ({preferred}) failed: {e} — trying fallback")
        try:
            return fallback(prompt)
        except Exception as e2:
            logger.error(f"Both LLMs failed for ({ctx.persona}, {alert_type}): {e2}")
            # Graceful degraded fallback — plain text, no LLM
            return (
                f"⚠️ **Air Quality Alert — {ctx.locality}, {ctx.city}**\n\n"
                f"Current PM2.5: **{ctx.stats.avg_pm25} µg/m³** ({ctx.stats.severity.replace('_', ' ').title()})\n"
                f"Trend: {ctx.stats.trend.capitalize()}\n\n"
                f"Please check the PodScout app for full details."
            )
