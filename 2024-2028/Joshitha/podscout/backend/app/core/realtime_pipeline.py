"""
Real-Time Data Pipeline Orchestrator

Coordinates the entire data flow:
1. Periodic data ingestion (every hour)
2. Automatic grid feature aggregation
3. Live updates to MCP servers
4. Real-time pollution monitoring

Runs as background task in FastAPI.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from ..ingestion.scheduler import scheduler as ingestion_scheduler
from ..spatial.feature_aggregator import feature_aggregator
from ..services.supabase import get_supabase

logger = logging.getLogger(__name__)

# PM2.5 thresholds (µg/m³) aligned with India NAAQS / WHO guidelines
PM25_CRITICAL_THRESHOLD = int(os.environ.get("PM25_CRITICAL_THRESHOLD", "150"))
PM25_HIGH_THRESHOLD = int(os.environ.get("PM25_HIGH_THRESHOLD", "100"))
# Optional: POST alert payload to this URL (e.g. Slack/Pagerduty webhook)
ALERT_WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL", "")


class RealtimePipeline:
    """
    Orchestrate real-time data pipeline.
    
    Manages:
    - Periodic ingestion (hourly)
    - Feature aggregation after ingestion
    - Grid updates
    - Monitoring and health checks
    """
    
    def __init__(self):
        self.running = False
        self.last_ingestion: Optional[datetime] = None
        self.last_aggregation: Optional[datetime] = None
        self.ingestion_interval_hours = 1
        self.errors_count = 0
        self._task: Optional[asyncio.Task] = None  # strong ref prevents GC
    
    async def start(self):
        """Start the real-time pipeline."""
        if self.running:
            logger.warning("Pipeline already running")
            return
        
        self.running = True
        logger.info("🚀 Starting Real-Time Data Pipeline")
        
        # Run initial setup
        await self._initial_setup()
        
        # Start periodic tasks — keep a strong reference so the task is not GC'd
        self._task = asyncio.create_task(self._periodic_ingestion_loop())
        
        logger.info("✅ Real-Time Pipeline Started")
    
    async def stop(self):
        """Stop the real-time pipeline."""
        self.running = False
        if self._task is not None:
            self._task.cancel()
            self._task = None
        logger.info("🛑 Real-Time Pipeline Stopped")
    
    async def _initial_setup(self):
        """
        Run initial setup tasks.
        
        - Check database connection
        - Verify grid cells exist
        - Run initial feature aggregation
        """
        logger.info("📋 Running initial setup...")
        
        # Check database
        supabase = get_supabase()
        if not supabase:
            logger.warning("⚠️  Supabase not configured - pipeline will run with limited functionality")
            return
        
        # Check if grid cells exist
        try:
            result = supabase.table("grid_cells").select("id").limit(1).execute()
            if not result.data:
                logger.warning("⚠️  No grid cells found. Generate grids first using /api/v1/spatial/grid/generate/major-cities")
        except Exception as e:
            logger.error(f"❌ Error checking grid cells: {e}")
    
    async def _periodic_ingestion_loop(self):
        """
        Main loop for periodic data ingestion.
        
        Runs every hour (configurable).
        """
        logger.info(f"⏰ Starting periodic ingestion loop (every {self.ingestion_interval_hours}h)")
        
        while self.running:
            try:
                # Run ingestion
                await self._run_ingestion_cycle()
                
                # Wait for next cycle
                await asyncio.sleep(self.ingestion_interval_hours * 3600)
                
            except Exception as e:
                logger.error(f"❌ Error in ingestion loop: {e}")
                self.errors_count += 1
                
                # Wait before retry
                await asyncio.sleep(300)  # 5 minutes
    
    async def _run_ingestion_cycle(self):
        """
        Run a complete ingestion cycle.
        
        Steps:
        1. Fetch data from all sources
        2. Store in database
        3. Aggregate grid features
        4. Update statistics
        """
        cycle_start = datetime.utcnow()
        logger.info(f"\n{'='*60}")
        logger.info(f"🔄 STARTING INGESTION CYCLE - {cycle_start.isoformat()}")
        logger.info(f"{'='*60}\n")
        
        try:
            # 1. Run data ingestion
            logger.info("📥 Step 1/3: Data Ingestion")
            ingestion_result = await ingestion_scheduler.run_daily_ingestion()
            self.last_ingestion = datetime.utcnow()
            
            logger.info(f"  ✓ Ingestion completed:")
            logger.info(f"    - Satellite: {sum(v.get('count', 0) for v in ingestion_result.get('satellite', {}).values())} records")
            logger.info(f"    - Ground Sensors: {sum(v.get('count', 0) for v in ingestion_result.get('ground_sensors', {}).values())} records")
            logger.info(f"    - Database Inserts: {ingestion_result.get('database_inserts', {})}")
            
            # 2. Aggregate grid features
            logger.info("\n📊 Step 2/3: Grid Feature Aggregation")
            aggregation_result = await feature_aggregator.aggregate_all_cells()
            self.last_aggregation = datetime.utcnow()
            
            logger.info(f"  ✓ Aggregation completed:")
            logger.info(f"    - Cells Updated: {aggregation_result.get('cells_updated', 0)}")
            
            # 3. Update statistics
            logger.info("\n📈 Step 3/3: Statistics Update")
            stats = await self._update_statistics()
            logger.info(f"  ✓ Statistics updated:")
            logger.info(f"    - Active Sites: {stats.get('active_sites', 0)}")
            logger.info(f"    - Critical Hotspots: {stats.get('critical_hotspots', 0)}")
            
            # Success
            cycle_duration = (datetime.utcnow() - cycle_start).total_seconds()
            logger.info(f"\n{'='*60}")
            logger.info(f"✅ CYCLE COMPLETED in {cycle_duration:.1f}s")
            logger.info(f"{'='*60}\n")
            self.errors_count = 0  # reset on success
            
        except Exception as e:
            logger.error(f"\n❌ CYCLE FAILED: {e}\n")
            self.errors_count += 1
            raise
    
    async def _update_statistics(self) -> dict:
        """Update system-wide statistics and fire alerts when thresholds are breached."""
        supabase = get_supabase()
        if not supabase:
            return {}

        try:
            # Count active sites
            sites_result = supabase.table("monitoring_sites").select("id, pm25, name, city").eq("active", True).execute()
            sites = sites_result.data

            # Calculate hotspot counts
            critical_sites = [s for s in sites if (s.get("pm25") or 0) >= PM25_CRITICAL_THRESHOLD]
            high_sites = [s for s in sites if PM25_HIGH_THRESHOLD <= (s.get("pm25") or 0) < PM25_CRITICAL_THRESHOLD]

            stats = {
                "active_sites": len(sites),
                "critical_hotspots": len(critical_sites),
                "high_hotspots": len(high_sites),
                "timestamp": datetime.utcnow().isoformat()
            }

            # Fire alerts for any critical sites
            if critical_sites:
                await self._fire_alert(critical_sites, level="CRITICAL")
            elif high_sites:
                await self._fire_alert(high_sites, level="HIGH")

            return stats

        except Exception as e:
            logger.error(f"Error updating statistics: {e}")
            return {}

    async def _fire_alert(self, sites: list, level: str) -> None:
        """Log and optionally POST an alert for PM2.5 threshold breaches.

        Set env var ALERT_WEBHOOK_URL to a Slack/PagerDuty/custom webhook URL
        to receive rich push notifications. Falls back to structured log-only.
        """
        site_summary = ", ".join(
            f"{s.get('city', '?')} / {s.get('name', '?')} ({s.get('pm25', '?')} µg/m³)"
            for s in sites[:5]  # cap at 5 in the alert body
        )
        message = (
            f"🚨 AIR QUALITY ALERT [{level}] — {len(sites)} site(s) breached threshold: {site_summary}"
        )
        logger.warning(message)

        if ALERT_WEBHOOK_URL:
            try:
                import aiohttp
                payload = {
                    "text": message,
                    "level": level,
                    "sites": [
                        {"city": s.get("city"), "name": s.get("name"), "pm25": s.get("pm25")}
                        for s in sites
                    ],
                    "timestamp": datetime.utcnow().isoformat(),
                }
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        ALERT_WEBHOOK_URL, json=payload, timeout=aiohttp.ClientTimeout(total=5)
                    ) as resp:
                        if resp.status not in (200, 204):
                            logger.warning(f"Webhook responded with {resp.status}")
            except Exception as e:
                logger.error(f"Failed to POST alert to webhook: {e}")
    
    async def force_ingestion(self) -> dict:
        """
        Force immediate ingestion cycle (manual trigger).
        
        Returns:
            Result summary
        """
        logger.info("🔧 Manual ingestion triggered")
        await self._run_ingestion_cycle()
        return {
            "status": "completed",
            "last_ingestion": self.last_ingestion.isoformat() if self.last_ingestion else None,
            "last_aggregation": self.last_aggregation.isoformat() if self.last_aggregation else None
        }
    
    def get_status(self) -> dict:
        """Get pipeline status."""
        return {
            "running": self.running,
            "last_ingestion": self.last_ingestion.isoformat() if self.last_ingestion else None,
            "last_aggregation": self.last_aggregation.isoformat() if self.last_aggregation else None,
            "ingestion_interval_hours": self.ingestion_interval_hours,
            "errors_count": self.errors_count,
            "next_ingestion_eta": (
                self.last_ingestion + timedelta(hours=self.ingestion_interval_hours)
            ).isoformat() if self.last_ingestion else "pending"
        }


# Global pipeline instance
realtime_pipeline = RealtimePipeline()
