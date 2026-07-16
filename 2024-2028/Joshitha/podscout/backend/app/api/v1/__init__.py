"""API v1 initialization."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["v1"])

# Import and include sub-routers
from . import analysis, alerts, llm, ingestion, mcp, spatial, pipeline

router.include_router(analysis.router)
router.include_router(alerts.router)
router.include_router(llm.router)
router.include_router(ingestion.router)
router.include_router(mcp.router)
router.include_router(spatial.router)
router.include_router(pipeline.router)
