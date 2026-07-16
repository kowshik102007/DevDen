
from mcp.server.fastmcp import FastMCP
import logging
import asyncio
import re
from pathlib import Path
from typing import Dict, Any

try:
    from backend.app.ml.train_model import train_city
except ImportError as e:
    logging.error(f"Training Agent Import Error: {e}")

mcp = FastMCP("PodScout Training Agent")
logger = logging.getLogger(__name__)

# Absolute path relative to this file — matches train_model.py path logic
MODELS_DIR = Path(__file__).parent.parent / "ml" / "models"

# Per-city locks to prevent concurrent training of the same city
_training_locks: Dict[str, asyncio.Lock] = {}
_TRAINING_TIMEOUT_S = 600  # 10-minute hard limit per city


def _get_lock(city_slug: str) -> asyncio.Lock:
    if city_slug not in _training_locks:
        _training_locks[city_slug] = asyncio.Lock()
    return _training_locks[city_slug]


@mcp.tool()
async def check_and_train_model(city: str) -> Dict[str, Any]:
    """
    Check if a model exists for the city. If not, train one dynamically.
    Returns model status.
    """
    city_slug    = re.sub(r'[^a-z0-9]', '_', city.lower())
    weights_path = MODELS_DIR / f"{city_slug}_weights.pt"
    scaler_path  = MODELS_DIR / f"{city_slug}_scaler.pt"

    if weights_path.exists() and scaler_path.exists():
        return {
            "status": "ready",
            "city":   city,
            "msg":    f"Model for {city} already exists.",
            "paths":  {"weights": str(weights_path), "scaler": str(scaler_path)},
        }

    logger.info(f"Model missing for {city}. Initiating training...")

    lock = _get_lock(city_slug)
    if lock.locked():
        return {
            "status": "in_progress",
            "city":   city,
            "msg":    f"Training already in progress for {city}. Try again shortly.",
        }

    async with lock:
        # Double-check after acquiring lock (another waiter may have just trained it)
        if weights_path.exists() and scaler_path.exists():
            return {
                "status": "ready",
                "city":   city,
                "msg":    f"Model for {city} was just trained by a concurrent request.",
                "paths":  {"weights": str(weights_path), "scaler": str(scaler_path)},
            }

        try:
            success = await asyncio.wait_for(train_city(city), timeout=_TRAINING_TIMEOUT_S)
            if success:
                return {
                    "status": "trained",
                    "city":   city,
                    "msg":    f"Successfully trained new model for {city}.",
                    "paths":  {"weights": str(weights_path), "scaler": str(scaler_path)},
                }
            return {
                "status": "failed",
                "city":   city,
                "msg":    "Training returned False — graph build error or insufficient data.",
            }
        except asyncio.TimeoutError:
            logger.error("Training timed out for %s after %ds", city, _TRAINING_TIMEOUT_S)
            return {
                "status": "timeout",
                "city":   city,
                "msg":    f"Training exceeded {_TRAINING_TIMEOUT_S}s limit.",
            }
        except Exception as e:
            logger.exception("Training error for %s", city)
            return {"status": "error", "city": city, "msg": str(e)}


if __name__ == "__main__":
    mcp.run(transport="stdio")

