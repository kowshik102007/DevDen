"""
Celery Worker Application
=========================
Offloads long-running CPU/IO work (ingestion, model training) from the
FastAPI web process so HTTP requests are never blocked.

Usage
-----
Start workers (from repo root):

    celery -A workers.celery_app worker --loglevel=info --concurrency=4

Beat scheduler (for periodic ingestion, alternative to realtime_pipeline):

    celery -A workers.celery_app beat --loglevel=info

Environment variables required:
    CELERY_BROKER_URL   — Redis URL, default redis://localhost:6379/0
    CELERY_RESULT_URL   — Redis URL, default redis://localhost:6379/1
"""

import logging
import os
import celery.schedules
from celery import Celery
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

# ---------------------------------------------------------------------------
# App creation
# ---------------------------------------------------------------------------
BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_URL", "redis://localhost:6379/1")

celery_app = Celery(
    "podscout",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=["workers.celery_app"],  # auto-discover tasks in this module
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Retry failed tasks up to 3 times with exponential back-off
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Beat schedule — periodic tasks
    beat_schedule={
        "hourly-ingestion": {
            "task": "workers.celery_app.run_ingestion",
            "schedule": 3600.0,  # every hour
        },
        # Alert: check PM2.5 threshold breaches every 30 minutes
        "alert-threshold-check": {
            "task": "workers.celery_app.alert_threshold_check",
            "schedule": 1800.0,
        },
        # Alert: daily summaries at 02:30 UTC (≈ 08:00 IST)
        "alert-daily-summaries": {
            "task": "workers.celery_app.send_daily_alerts",
            "schedule": celery.schedules.crontab(hour=2, minute=30),
        },
        # Alert: weekly plans every Monday at 02:30 UTC
        "alert-weekly-plans": {
            "task": "workers.celery_app.send_weekly_alerts",
            "schedule": celery.schedules.crontab(hour=2, minute=30, day_of_week="monday"),
        },
        # Alert: monthly reports on the 1st of each month at 03:00 UTC
        "alert-monthly-reports": {
            "task": "workers.celery_app.send_monthly_alerts",
            "schedule": celery.schedules.crontab(hour=3, minute=0, day_of_month=1),
        },
    },
)

# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@celery_app.task(
    name="workers.celery_app.run_ingestion",
    bind=True,
    max_retries=3,
    default_retry_delay=120,
)
def run_ingestion(self) -> dict:
    """
    Fetch data from all sources (CPCB, OpenAQ, Sentinel-5P, Landsat) and
    persist to Supabase.  Runs async code in a fresh event loop.
    """
    import asyncio
    from backend.app.ingestion.scheduler import scheduler as ingestion_scheduler

    try:
        result = asyncio.run(ingestion_scheduler.run_daily_ingestion())
        logger.info(
            "Ingestion complete — sites=%s measurements=%s duration=%.1fs",
            result.get("database_inserts", {}).get("monitoring_sites", 0),
            result.get("database_inserts", {}).get("measurements", 0),
            result.get("duration_seconds", 0),
        )
        return result
    except Exception as exc:
        logger.error("Ingestion task failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task(
    name="workers.celery_app.train_city_model",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
    time_limit=900,  # hard-kill after 15 min
    soft_time_limit=840,
)
def train_city_model(
    self,
    city: str,
    num_epochs: int = 30,
    seq_len: int = 12,
) -> dict:
    """
    Train (or retrain) the Bayesian ST-GNN for a single city.

    Parameters
    ----------
    city : str
        City name as stored in the DB (e.g. "Delhi", "Mumbai").
    num_epochs : int
        Training epochs (default 30).
    seq_len : int
        Input sequence length in hours (default 12).

    Returns
    -------
    dict with keys ``success``, ``city``, ``message``.
    """
    import asyncio
    from celery.exceptions import SoftTimeLimitExceeded
    from backend.app.ml.train_model import train_city

    try:
        success = asyncio.run(train_city(city, num_epochs=num_epochs, seq_len=seq_len))
        msg = f"Training {'succeeded' if success else 'failed (no data?)'} for {city}"
        logger.info(msg)
        return {"success": success, "city": city, "message": msg}
    except SoftTimeLimitExceeded:
        msg = f"Training for {city} exceeded soft time limit — aborting gracefully"
        logger.warning(msg)
        return {"success": False, "city": city, "message": msg}
    except Exception as exc:
        logger.error("Training task failed for %s: %s", city, exc)
        raise self.retry(exc=exc)


@celery_app.task(name="workers.celery_app.aggregate_grid_features", bind=True, max_retries=2)
def aggregate_grid_features(self) -> dict:
    """
    Aggregate the latest measurements into grid-cell feature vectors used
    by the ST-GNN model and the frontend heatmap.
    """
    import asyncio
    from backend.app.spatial.feature_aggregator import feature_aggregator

    try:
        result = asyncio.run(feature_aggregator.aggregate_all_cells())
        logger.info("Aggregation complete — cells_updated=%s", result.get("cells_updated", 0))
        return result
    except Exception as exc:
        logger.error("Aggregation task failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Alert tasks
# ---------------------------------------------------------------------------

@celery_app.task(
    name="workers.celery_app.alert_threshold_check",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def alert_threshold_check(self) -> dict:
    """
    Check all users' PM2.5 threshold subscriptions and fire alerts where
    the current PM2.5 exceeds their personal threshold.
    Runs every 30 minutes via Beat.
    """
    import asyncio
    from backend.app.alerts.alert_scheduler import scheduler

    try:
        result = asyncio.run(scheduler.check_threshold_breaches())
        logger.info("Threshold check — sent=%s skipped=%s", result.get("sent"), result.get("skipped"))
        return result
    except Exception as exc:
        logger.error("alert_threshold_check failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task(
    name="workers.celery_app.send_daily_alerts",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def send_daily_alerts(self) -> dict:
    """
    Send daily morning summaries (individual), city dashboards (municipality).
    Runs at 02:30 UTC (08:00 IST) every day via Beat.
    """
    import asyncio
    from backend.app.alerts.alert_scheduler import scheduler

    try:
        result = asyncio.run(scheduler.run_daily_summaries())
        logger.info("Daily alerts — sent=%s skipped=%s", result.get("sent"), result.get("skipped"))
        return result
    except Exception as exc:
        logger.error("send_daily_alerts failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task(
    name="workers.celery_app.send_weekly_alerts",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def send_weekly_alerts(self) -> dict:
    """
    Send weekly plans / digests / policy briefs by persona.
    Runs every Monday at 02:30 UTC via Beat.
    """
    import asyncio
    from backend.app.alerts.alert_scheduler import scheduler

    try:
        result = asyncio.run(scheduler.run_weekly_plans())
        logger.info("Weekly alerts — sent=%s skipped=%s", result.get("sent"), result.get("skipped"))
        return result
    except Exception as exc:
        logger.error("send_weekly_alerts failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task(
    name="workers.celery_app.send_monthly_alerts",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def send_monthly_alerts(self) -> dict:
    """
    Send monthly health plans (community) and regulatory reports (municipality).
    Runs on the 1st of each month at 03:00 UTC via Beat.
    """
    import asyncio
    from backend.app.alerts.alert_scheduler import scheduler

    try:
        result = asyncio.run(scheduler.run_monthly_reports())
        logger.info("Monthly alerts — sent=%s skipped=%s", result.get("sent"), result.get("skipped"))
        return result
    except Exception as exc:
        logger.error("send_monthly_alerts failed: %s", exc)
        raise self.retry(exc=exc)
