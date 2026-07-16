"""Analysis API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from ...llm.orchestrator import orchestrator
from ...middleware.auth import get_current_user
from ...services.supabase import get_supabase
import logging

router = APIRouter(prefix="/analysis", tags=["analysis"])
logger = logging.getLogger(__name__)


class SiteData(BaseModel):
    """Site data model."""
    id: str
    lat: float
    lon: float
    pm25: float
    temperature: Optional[float] = None
    population_density: Optional[int] = None


class AnalysisResponse(BaseModel):
    """Analysis response model."""
    site_id: str
    analysis: Dict[str, Any]
    explanation: str
    llm_provider: str


@router.post("/site", response_model=AnalysisResponse)
async def analyze_site(
    site_data: SiteData,
    current_user: dict = Depends(get_current_user),
):
    """
    Analyze a pollution site using LLM.
    Requires authentication to prevent unmetered LLM quota use.
    """
    try:
        site_dict = site_data.model_dump()
        analysis    = orchestrator.analyze_site(site_dict, provider="auto")
        explanation = orchestrator.explain_to_user(site_dict, analysis)
        return AnalysisResponse(
            site_id=site_data.id,
            analysis=analysis,
            explanation=explanation,
            llm_provider="groq/gemini",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hotspots")
async def get_hotspots(
    limit: int = Query(default=10, ge=1, le=100),
    city: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    """
    Get top pollution hotspots from the monitoring_sites table, ordered by PM2.5.
    Requires authentication.
    """
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        query = (
            supabase.table("monitoring_sites")
            .select("id, city, latitude, longitude, avg_pm25, site_name")
            .order("avg_pm25", desc=True)
            .limit(limit)
        )
        if city:
            query = query.eq("city", city)

        result = query.execute()
        rows = result.data or []

        hotspots = [
            {
                "id":       r.get("id", ""),
                "city":     r.get("city", ""),
                "name":     r.get("site_name", ""),
                "lat":      r.get("latitude"),
                "lon":      r.get("longitude"),
                "pm25":     r.get("avg_pm25", 0),
                "severity": _severity(r.get("avg_pm25", 0)),
            }
            for r in rows
        ]
        return {"hotspots": hotspots, "count": len(hotspots)}

    except Exception as e:
        logger.exception("hotspots query failed")
        raise HTTPException(status_code=500, detail=str(e))


def _severity(pm25: float) -> str:
    if pm25 >= 250:
        return "severe"
    if pm25 >= 120:
        return "very_poor"
    if pm25 >= 90:
        return "poor"
    if pm25 >= 60:
        return "moderate"
    return "good"


@router.post("/deployment-strategy")
async def generate_deployment_strategy(
    hotspots: List[SiteData],
    current_user: dict = Depends(get_current_user),
):
    """
    Generate Climate Pod deployment strategy using Gemini.
    Requires authentication.
    """
    try:
        hotspot_dicts = [site.model_dump() for site in hotspots]
        strategy = orchestrator.generate_deployment_strategy(hotspot_dicts)
        return {
            "strategy":           strategy,
            "hotspots_analyzed":  len(hotspot_dicts),
            "llm_provider":       "gemini",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

