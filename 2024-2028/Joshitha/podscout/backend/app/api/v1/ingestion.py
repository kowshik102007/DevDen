"""Ingestion API endpoints."""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional
from ...ingestion.scheduler import scheduler

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class IngestionResponse(BaseModel):
    """Ingestion job response."""
    status: str
    message: str
    job_id: Optional[str] = None


@router.post("/trigger")
async def trigger_ingestion(background_tasks: BackgroundTasks):
    """
    Manually trigger data ingestion pipeline.
    
    Runs ingestion in background and returns immediately.
    """
    async def run_ingestion():
        try:
            result = await scheduler.run_daily_ingestion()
            logger.info(f"Ingestion completed: {result}")
        except Exception as e:
            logger.error(f"Ingestion failed: {e}")
    
    background_tasks.add_task(run_ingestion)
    
    return {
        "status": "started",
        "message": "Data ingestion pipeline started in background",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/trigger/sync")
async def trigger_ingestion_sync():
    """
    Manually trigger data ingestion pipeline (synchronous).
    
    Waits for ingestion to complete and returns detailed results.
    """
    try:
        result = await scheduler.run_daily_ingestion()
        return {
            "status": "completed",
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_ingestion_status():
    """Get current ingestion pipeline status."""
    return {
        "running": scheduler.running,
        "last_run": None,  # Would track this in production
        "next_scheduled": "Daily at 00:00 UTC"
    }


@router.get("/sources")
async def list_data_sources():
    """List all available data sources."""
    return {
        "satellite": [
            {
                "name": "Sentinel-5P",
                "parameters": ["NO2", "SO2"],
                "resolution": "3.5km x 7km",
                "revisit": "Daily"
            },
            {
                "name": "Landsat 8/9",
                "parameters": ["LST"],
                "resolution": "30m",
                "revisit": "8-16 days"
            }
        ],
        "ground_sensors": [
            {
                "name": "CPCB",
                "coverage": "India",
                "parameters": ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"],
                "frequency": "Real-time"
            },
            {
                "name": "OpenAQ",
                "coverage": "Global",
                "parameters": ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"],
                "frequency": "Real-time"
            }
        ]
    }
