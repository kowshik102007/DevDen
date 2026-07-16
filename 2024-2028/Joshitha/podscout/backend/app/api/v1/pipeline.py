"""
Pipeline Management API

Endpoints to control and monitor the real-time data pipeline.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.get("/status")
async def get_pipeline_status():
    """
    Get real-time pipeline status.
    
    Returns:
        Current pipeline state, last run times, and health info
    """
    from ...core.realtime_pipeline import realtime_pipeline
    
    status = realtime_pipeline.get_status()
    
    return {
        "status": "healthy" if status["running"] else "stopped",
        "pipeline": status,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/trigger")
async def trigger_pipeline():
    """
    Manually trigger an immediate ingestion cycle.
    
    Forces:
    1. Data ingestion from all sources
    2. Grid feature aggregation
    3. Statistics update
    """
    from ...core.realtime_pipeline import realtime_pipeline
    
    if not realtime_pipeline.running:
        raise HTTPException(
            status_code=503,
            detail="Pipeline is not running. Start the backend to enable pipeline."
        )
    
    try:
        result = await realtime_pipeline.force_ingestion()
        return {
            "status": "completed",
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def pipeline_health():
    """
    Comprehensive pipeline health check.
    
    Checks:
    - Pipeline running status
    - Database connectivity
    - Last successful ingestion
    - Error count
    """
    from ...core.realtime_pipeline import realtime_pipeline
    from ...services.supabase import get_supabase
    
    status = realtime_pipeline.get_status()
    supabase = get_supabase()
    
    # Calculate health score
    health_score = 100
    issues = []
    
    if not status["running"]:
        health_score -= 50
        issues.append("Pipeline not running")
    
    if not supabase:
        health_score -= 30
        issues.append("Database not connected")
    
    if status["errors_count"] > 0:
        health_score -= min(20, status["errors_count"] * 5)
        issues.append(f"{status['errors_count']} errors occurred")
    
    if not status["last_ingestion"]:
        health_score -= 20
        issues.append("No ingestion has run yet")
    
    return {
        "health_score": max(0, health_score),
        "status": "healthy" if health_score >= 70 else "degraded" if health_score >= 40 else "unhealthy",
        "issues": issues,
        "details": {
            "pipeline_running": status["running"],
            "database_connected": supabase is not None,
            "last_ingestion": status["last_ingestion"],
            "errors": status["errors_count"]
        },
        "timestamp": datetime.utcnow().isoformat()
    }
