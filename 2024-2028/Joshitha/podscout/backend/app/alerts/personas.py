"""
Persona Context Builder
=======================
Aggregates locality-specific air quality data and builds a PersonaContext
that the alert generator uses to produce personalised, locality-aware alerts.

Three personas:
  individual   — personal health at the user's home location (≤ 3 km radius)
  community    — ward / RWA / school area (2-5 km radius, collective action)
  municipality — city / ward administration (full city, policy + resources)
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Persona(str, Enum):
    INDIVIDUAL   = "individual"
    COMMUNITY    = "community"
    MUNICIPALITY = "municipality"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class LocalityStats:
    """Aggregated, locality-scoped air quality snapshot."""
    city: str
    locality: str
    lat: float
    lon: float
    radius_km: float
    avg_pm25: float
    max_pm25: float
    min_pm25: float
    num_sites: int
    critical_sites: int     # PM2.5 >= 150
    high_sites: int         # PM2.5 100–149
    trend: str              # "improving" | "worsening" | "stable"
    forecast_24h: Optional[float] = None
    sources: List[str] = field(default_factory=list)

    @property
    def severity(self) -> str:
        if self.avg_pm25 >= 250: return "severe"
        if self.avg_pm25 >= 150: return "very_poor"
        if self.avg_pm25 >= 100: return "poor"
        if self.avg_pm25 >= 60:  return "moderate"
        return "good"


@dataclass
class PersonaContext:
    """All context required to generate a personalised alert."""
    user_id: str
    persona: Persona
    name: str
    locality: str
    city: str
    language: str               # ISO 639-1: "en", "hi", "te", "mr", "ta"
    threshold_pm25: float
    stats: LocalityStats
    extra: Dict[str, Any] = field(default_factory=dict)
    # extra keys by persona:
    #   individual:   health_conditions (list), children_present (bool), outdoor_job (bool)
    #   community:    org_name (str), member_count (int), has_school (bool), meeting_day (str)
    #   municipality: ward_id (str), ward_name (str), population (int), num_sensors (int),
    #                 budget_crore (float)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _compute_trend(city: str) -> str:
    """
    Derive 'improving' | 'worsening' | 'stable' from the last ~20 measurements.
    Returns 'stable' on any error so callers never crash.
    """
    try:
        from backend.app.services.supabase import get_supabase
        supabase = get_supabase()
        if not supabase:
            return "stable"

        res = (
            supabase.table("measurements")
            .select("pm25, measured_at")
            .eq("city", city)
            .order("measured_at", desc=True)
            .limit(24)
            .execute()
        )
        vals = [r["pm25"] for r in (res.data or []) if r.get("pm25")]
        if len(vals) < 4:
            return "stable"

        half = len(vals) // 2
        older = sum(vals[half:]) / (len(vals) - half)
        newer = sum(vals[:half]) / half
        if newer > older * 1.05:
            return "worsening"
        if newer < older * 0.95:
            return "improving"
        return "stable"
    except Exception:
        return "stable"


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def build_context(user_id: str) -> Optional[PersonaContext]:
    """
    Build a PersonaContext for a user:
    1. Load user_profile from Supabase (includes persona, locality, lat/lon)
    2. Query monitoring_sites within the user's radius
    3. Compute LocalityStats
    4. Detect PM2.5 trend from recent measurements

    Returns None if the profile doesn't exist or Supabase is unavailable.
    """
    from backend.app.services.supabase import get_supabase
    supabase = get_supabase()
    if not supabase:
        logger.error("Supabase unavailable — cannot build PersonaContext")
        return None

    # 1. Load user profile
    try:
        res = (
            supabase.table("user_profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile: Dict[str, Any] = res.data or {}
    except Exception as e:
        logger.error(f"Failed to load profile for {user_id}: {e}")
        return None

    if not profile:
        logger.warning(f"No user_profile row for {user_id}")
        return None

    # Extract core fields
    lat       = float(profile.get("home_lat") or 28.6139)
    lon       = float(profile.get("home_lon") or 77.2090)
    city      = profile.get("default_city") or "Delhi"
    locality  = profile.get("locality") or city
    persona   = Persona(profile.get("persona") or "individual")
    language  = profile.get("preferred_language") or "en"
    name      = profile.get("full_name") or profile.get("email") or "Resident"
    threshold = float(profile.get("alert_threshold_pm25") or 100.0)
    radius_km = float(profile.get("locality_radius_km") or 2.0)
    meta      = profile.get("persona_meta") or {}

    # 2. Fetch active monitoring sites for the city
    try:
        sites_res = (
            supabase.table("monitoring_sites")
            .select("id, name, lat, lon, pm25, source")
            .eq("city", city)
            .eq("active", True)
            .execute()
        )
        all_sites: List[Dict] = sites_res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch sites for {city}: {e}")
        all_sites = []

    # 3. Filter to user's radius (municipalities use all city sites)
    if persona == Persona.MUNICIPALITY:
        nearby = all_sites
    else:
        nearby = [
            s for s in all_sites
            if s.get("lat") and s.get("lon")
            and _haversine_km(lat, lon, float(s["lat"]), float(s["lon"])) <= radius_km
        ]
        if not nearby:
            nearby = all_sites  # fallback: use all city sites

    pm25_vals = [float(s.get("pm25") or 0.0) for s in nearby]
    avg_pm25  = sum(pm25_vals) / max(len(pm25_vals), 1)

    # 4. Compute trend
    trend = _compute_trend(city)

    stats = LocalityStats(
        city=city,
        locality=locality,
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        avg_pm25=round(avg_pm25, 1),
        max_pm25=round(max(pm25_vals, default=0.0), 1),
        min_pm25=round(min(pm25_vals, default=0.0), 1),
        num_sites=len(nearby),
        critical_sites=sum(1 for v in pm25_vals if v >= 150),
        high_sites=sum(1 for v in pm25_vals if 100 <= v < 150),
        trend=trend,
        sources=list({s.get("source", "unknown") for s in nearby}),
    )

    return PersonaContext(
        user_id=user_id,
        persona=persona,
        name=name,
        locality=locality,
        city=city,
        language=language,
        threshold_pm25=threshold,
        stats=stats,
        extra=meta,
    )


def build_context_from_profile(profile: Dict[str, Any], sites: List[Dict]) -> PersonaContext:
    """
    Synchronous variant — construct PersonaContext when the caller already has
    the profile dict and nearby sites list (e.g. in unit tests or batch jobs).
    """
    lat       = float(profile.get("home_lat") or 28.6139)
    lon       = float(profile.get("home_lon") or 77.2090)
    city      = profile.get("default_city") or "Delhi"
    locality  = profile.get("locality") or city
    persona   = Persona(profile.get("persona") or "individual")
    language  = profile.get("preferred_language") or "en"
    name      = profile.get("full_name") or profile.get("email") or "Resident"
    threshold = float(profile.get("alert_threshold_pm25") or 100.0)
    radius_km = float(profile.get("locality_radius_km") or 2.0)
    meta      = profile.get("persona_meta") or {}

    pm25_vals = [float(s.get("pm25") or 0.0) for s in sites]
    avg_pm25  = sum(pm25_vals) / max(len(pm25_vals), 1)

    stats = LocalityStats(
        city=city,
        locality=locality,
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        avg_pm25=round(avg_pm25, 1),
        max_pm25=round(max(pm25_vals, default=0.0), 1),
        min_pm25=round(min(pm25_vals, default=0.0), 1),
        num_sites=len(sites),
        critical_sites=sum(1 for v in pm25_vals if v >= 150),
        high_sites=sum(1 for v in pm25_vals if 100 <= v < 150),
        trend="stable",
        sources=list({s.get("source", "unknown") for s in sites}),
    )

    return PersonaContext(
        user_id=profile.get("id", ""),
        persona=persona,
        name=name,
        locality=locality,
        city=city,
        language=language,
        threshold_pm25=threshold,
        stats=stats,
        extra=meta,
    )
