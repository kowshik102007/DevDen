"""
Feature Aggregation Agent (MCP Server)

Aggregates raw data into grid_cells features:
- Temporal rolling averages (1h, 24h, 7d)
- Trend and volatility calculations
- Static urban features from OSM
"""

from mcp.server.fastmcp import FastMCP
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta

try:
    from backend.app.services.supabase import get_supabase
    from backend.app.ingestion.osm import osm_fetcher
    from backend.app.ingestion.weather import weather_fetcher
except ImportError as e:
    logging.error(f"Feature Agg import error: {e}")

mcp = FastMCP("PodScout Feature Aggregation Agent")
logger = logging.getLogger(__name__)


@mcp.tool()
async def aggregate_temporal_features(city: str) -> Dict[str, Any]:
    """
    Calculate temporal rolling features for all cells in a city.
    
    Updates: pm25_1h, pm25_24h, pm25_7d, pm25_trend, pm25_volatility
    """
    supabase = get_supabase()
    if not supabase:
        return {"status": "error", "message": "DB not connected."}
    
    try:
        # 1. Get all cells for city
        cells_res = supabase.table("grid_cells").select("id, gnn_node_id").eq("city", city).execute()
        cells = cells_res.data
        
        if not cells:
            return {"status": "skip", "message": f"No cells for {city}."}
        
        updated = 0
        
        for cell in cells:
            cell_id = cell["id"]
            
            # 2. Fetch measurements for this cell (via monitoring sites in cell)
            # This requires spatial join - simplified: use city-wide aggregation
            now = datetime.utcnow()
            
            meas_res = supabase.table("measurements") \
                .select("pm25, measured_at") \
                .gte("measured_at", (now - timedelta(days=7)).isoformat()) \
                .order("measured_at", desc=True) \
                .limit(168) \
                .execute()
            
            measurements = meas_res.data
            
            if not measurements:
                continue
            
            # 3. Calculate rolling aggregates
            pm25_values = [m["pm25"] for m in measurements if m.get("pm25")]
            
            if len(pm25_values) < 2:
                continue
            
            pm25_1h = sum(pm25_values[:1]) / max(1, len(pm25_values[:1])) if pm25_values else 0
            pm25_24h = sum(pm25_values[:24]) / max(1, len(pm25_values[:24])) if len(pm25_values) >= 24 else pm25_1h
            pm25_7d = sum(pm25_values) / len(pm25_values)
            
            # Trend: simple slope (last - first) / count
            pm25_trend = (pm25_values[0] - pm25_values[-1]) / len(pm25_values) if len(pm25_values) > 1 else 0
            
            # Volatility: standard deviation
            mean = pm25_7d
            variance = sum((x - mean) ** 2 for x in pm25_values) / len(pm25_values)
            pm25_volatility = variance ** 0.5
            
            # Max/Min
            max_pm25 = max(pm25_values)
            min_pm25 = min(pm25_values)
            
            # 4. Update cell
            updates = {
                "pm25_1h": round(pm25_1h, 2),
                "pm25_24h": round(pm25_24h, 2),
                "pm25_7d": round(pm25_7d, 2),
                "pm25_trend": round(pm25_trend, 4),
                "pm25_volatility": round(pm25_volatility, 2),
                "max_pm25": round(max_pm25, 2),
                "min_pm25": round(min_pm25, 2),
                "last_update": datetime.utcnow().isoformat()
            }
            
            supabase.table("grid_cells").update(updates).eq("id", cell_id).execute()
            updated += 1
        
        return {
            "status": "success",
            "city": city,
            "cells_updated": updated,
            "message": f"Updated temporal features for {updated} cells."
        }
        
    except Exception as e:
        logger.error(f"Temporal aggregation error: {e}")
        return {"status": "error", "message": str(e)}


@mcp.tool()
async def aggregate_static_features(city: str) -> Dict[str, Any]:
    """
    Fetch and store static urban features (building/road density, green cover).
    """
    supabase = get_supabase()
    if not supabase:
        return {"status": "error", "message": "DB not connected."}
    
    try:
        # 1. Get all cells for city
        cells_res = supabase.table("grid_cells") \
            .select("id, center_lat, center_lon, cell_size_meters") \
            .eq("city", city) \
            .execute()
        cells = cells_res.data
        
        if not cells:
            return {"status": "skip", "message": f"No cells for {city}."}
        
        logger.info(f"Fetching OSM features for {len(cells)} cells...")
        
        # 2. Fetch OSM data (rate-limited, ~10 cells max for prototype)
        sample_cells = cells[:10]  # Limit for API rate
        osm_data = osm_fetcher.fetch_for_cells(sample_cells)
        
        # 3. Update cells
        updated = 0
        for cell_id, features in osm_data.items():
            updates = {
                "building_density": features.get("building_density", 0),
                "road_density": features.get("road_density", 0),
                "green_cover": features.get("green_cover", 0),
                "last_update": datetime.utcnow().isoformat()
            }
            supabase.table("grid_cells").update(updates).eq("id", cell_id).execute()
            updated += 1
        
        return {
            "status": "success",
            "city": city,
            "cells_updated": updated,
            "message": f"Updated static features for {updated} cells."
        }
        
    except Exception as e:
        logger.error(f"Static aggregation error: {e}")
        return {"status": "error", "message": str(e)}


@mcp.tool()
async def aggregate_weather_data(city: str, bbox: List[float]) -> Dict[str, Any]:
    """
    Aggregate weather/climate data from existing grid cells (Landsat LST).
    Falls back to simulation if no external API is available.
    """
    supabase = get_supabase()
    if not supabase:
        return {"status": "error", "message": "DB not connected."}
    
    try:
        # Get cells with existing temperature data from Landsat
        cells_res = supabase.table("grid_cells") \
            .select("id, avg_temperature") \
            .eq("city", city) \
            .not_.is_("avg_temperature", "null") \
            .execute()
        
        cells_with_temp = cells_res.data
        
        if cells_with_temp:
            # Calculate average humidity from temperature (rough approximation)
            # Higher temp = lower humidity (inverse relationship for demo)
            avg_temp = sum(c["avg_temperature"] for c in cells_with_temp) / len(cells_with_temp)
            estimated_humidity = max(20, min(90, 100 - avg_temp))  # Simple inverse
            
            # Update all cells
            all_cells_res = supabase.table("grid_cells") \
                .select("id") \
                .eq("city", city) \
                .execute()
            
            updated = 0
            for cell in all_cells_res.data:
                supabase.table("grid_cells").update({
                    "avg_humidity": round(estimated_humidity, 1),
                    "last_update": datetime.utcnow().isoformat()
                }).eq("id", cell["id"]).execute()
                updated += 1
            
            return {
                "status": "success",
                "city": city,
                "cells_updated": updated,
                "source": "landsat_derived",
                "avg_humidity": round(estimated_humidity, 1),
                "message": f"Estimated humidity from Landsat LST for {updated} cells."
            }
        else:
            # No temperature data, use default
            return {
                "status": "skip",
                "city": city,
                "message": "No temperature data available. Run satellite ingestion first."
            }
        
    except Exception as e:
        logger.error(f"Weather aggregation error: {e}")
        return {"status": "error", "message": str(e)}


@mcp.resource("podscout://features/status/{city}")
def get_feature_status(city: str) -> str:
    """Get feature completeness status for a city."""
    import json
    supabase = get_supabase()
    
    if not supabase:
        return json.dumps({"error": "DB not connected"})
    
    try:
        res = supabase.table("grid_cells") \
            .select("avg_pm25, avg_no2, avg_humidity, building_density, pm25_trend") \
            .eq("city", city) \
            .limit(5) \
            .execute()
        
        cells = res.data
        if not cells:
            return json.dumps({"status": "no_data", "city": city})
        
        # Check completeness
        filled = {
            "avg_pm25": sum(1 for c in cells if c.get("avg_pm25") is not None),
            "avg_no2": sum(1 for c in cells if c.get("avg_no2") is not None),
            "avg_humidity": sum(1 for c in cells if c.get("avg_humidity") is not None),
            "building_density": sum(1 for c in cells if c.get("building_density")),
            "pm25_trend": sum(1 for c in cells if c.get("pm25_trend") is not None),
        }
        
        return json.dumps({
            "city": city,
            "sample_size": len(cells),
            "column_fill_counts": filled
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    mcp.run(transport="stdio")
