"""
Spatial Feature Aggregator

Aggregates features from multiple sources for each grid cell:
- Monitoring site measurements (within cell)
- Satellite data (overlapping cell)
- Temporal rolling features (1h, 24h, 7d)
- Spatial context (population, land use)
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging
import numpy as np

from ..services.supabase import get_supabase

logger = logging.getLogger(__name__)


class SpatialFeatureAggregator:
    """Aggregate multi-source features for grid cells."""
    
    def __init__(self):
        self.supabase = get_supabase()
    
    async def aggregate_cell_features(self, cell_id: str) -> Dict:
        """
        Aggregate all features for a grid cell.
        
        Returns:
            Dictionary with aggregated features
        """
        if not self.supabase:
            logger.warning("Supabase not configured")
            return {}
        
        features = {}
        
        try:
            # 1. Get cell info
            cell = await self._get_cell(cell_id)
            if not cell:
                return {}
            
            # 2. Aggregate from monitoring sites within cell
            site_features = await self._aggregate_site_measurements(cell)
            features.update(site_features)
            
            # 3. Add satellite data
            # satellite_features = await self._get_satellite_data(cell)
            # features.update(satellite_features)
            
            # 4. Calculate temporal features
            temporal_features = await self._compute_temporal_features(cell_id)
            features.update(temporal_features)
            
            # 5. Add spatial context
            spatial_features = await self._get_spatial_context(cell)
            features.update(spatial_features)
            
            # 6. Update cell in database
            await self._update_cell_features(cell_id, features)
            
            return features
        
        except Exception as e:
            logger.error(f"Error aggregating features for {cell_id}: {e}")
            return {}
    
    async def aggregate_all_cells(self, city: Optional[str] = None) -> Dict:
        """
        Aggregate features for all cells in a city or all cities.
        
        Returns:
            Summary of aggregation
        """
        logger.info(f"📊 Aggregating features for {'all cities' if not city else city}")
        
        # Get all cells
        query = self.supabase.table("grid_cells").select("id, city")
        if city:
            query = query.eq("city", city)
        
        result = query.execute()
        cells = result.data
        
        logger.info(f"  Processing {len(cells)} cells...")
        
        updated = 0
        for cell in cells:
            try:
                await self.aggregate_cell_features(cell["id"])
                updated += 1
            except Exception as e:
                logger.error(f"Error processing {cell['id']}: {e}")
        
        logger.info(f"  ✓ Updated {updated}/{len(cells)} cells")
        
        return {
            "cells_processed": len(cells),
            "cells_updated": updated,
            "city": city or "all"
        }
    
    async def _get_cell(self, cell_id: str) -> Optional[Dict]:
        """Get cell information from database."""
        result = self.supabase.table("grid_cells").select("*").eq("id", cell_id).execute()
        return result.data[0] if result.data else None
    
    async def _aggregate_site_measurements(self, cell: Dict) -> Dict:
        """
        Aggregate measurements from monitoring sites within the cell.
        
        Uses spatial query to find sites within cell bounds.
        """
        # Get sites within cell
        # For now, use simple lat/lon check (in production, use PostGIS ST_Within)
        center_lat = cell["center_lat"]
        center_lon = cell["center_lon"]
        cell_size = cell["cell_size_meters"]
        
        # Approximate degrees from meters
        lat_range = cell_size / 111320.0
        lon_range = cell_size / (111320.0 * np.cos(np.radians(center_lat)))
        
        # Query sites
        result = self.supabase.table("monitoring_sites").select("*")\
            .gte("lat", center_lat - lat_range / 2)\
            .lte("lat", center_lat + lat_range / 2)\
            .gte("lon", center_lon - lon_range / 2)\
            .lte("lon", center_lon + lon_range / 2)\
            .eq("active", True)\
            .execute()
        
        sites = result.data
        
        if not sites:
            return {
                "avg_pm25": None,
                "avg_pm10": None,
                "avg_no2": None,
                "avg_so2": None,
                "avg_temperature": None,
                "num_monitoring_sites": 0
            }
        
        # Aggregate measurements
        pm25_values = [s["pm25"] for s in sites if s.get("pm25") is not None]
        pm10_values = [s["pm10"] for s in sites if s.get("pm10") is not None]
        no2_values = [s["no2"] for s in sites if s.get("no2") is not None]
        so2_values = [s["so2"] for s in sites if s.get("so2") is not None]
        temp_values = [s["temperature"] for s in sites if s.get("temperature") is not None]
        
        return {
            "avg_pm25": float(np.mean(pm25_values)) if pm25_values else None,
            "avg_pm10": float(np.mean(pm10_values)) if pm10_values else None,
            "avg_no2": float(np.mean(no2_values)) if no2_values else None,
            "avg_so2": float(np.mean(so2_values)) if so2_values else None,
            "avg_temperature": float(np.mean(temp_values)) if temp_values else None,
            "max_pm25": float(np.max(pm25_values)) if pm25_values else None,
            "min_pm25": float(np.min(pm25_values)) if pm25_values else None,
            "num_monitoring_sites": len(sites)
        }
    
    async def _compute_temporal_features(self, cell_id: str) -> Dict:
        """
        Compute temporal rolling window features.
        
        Queries historical measurements table to calculate:
        - 1h, 24h, 7d rolling averages
        - Trend (linear regression coefficient)
        - Volatility (standard deviation)
        """
        # Get current time
        now = datetime.utcnow()
        
        # Query historical data (would come from measurements table)
        # For now, return placeholders
        
        # In production, would query:
        # SELECT pm25, measured_at FROM measurements
        # WHERE site_id IN (SELECT id FROM monitoring_sites WHERE ST_Within(...))
        # AND measured_at >= now - interval '7 days'
        # ORDER BY measured_at DESC
        
        return {
            "pm25_1h": None,      # 1-hour rolling average
            "pm25_24h": None,     # 24-hour rolling average
            "pm25_7d": None,      # 7-day rolling average
            "pm25_trend": None,   # Trend coefficient
            "pm25_volatility": None  # Standard deviation
        }
    
    async def _get_spatial_context(self, cell: Dict) -> Dict:
        """
        Get spatial context features.
        
        Includes:
        - Population density
        - Land use type
        - Nearest monitoring site distance
        """
        # For now, return what we have from cell
        return {
            "population_density": cell.get("population_density"),
            "land_use_type": cell.get("land_use_type", "mixed"),
            "nearest_site_distance": None  # Can be calculated
        }
    
    async def _update_cell_features(self, cell_id: str, features: Dict):
        """Update cell with aggregated features in database."""
        try:
            # Update only non-None values
            update_data = {k: v for k, v in features.items() if v is not None}
            update_data["last_update"] = datetime.utcnow().isoformat()
            
            self.supabase.table("grid_cells").update(update_data).eq("id", cell_id).execute()
        
        except Exception as e:
            logger.error(f"Error updating cell {cell_id}: {e}")


# Global instance
feature_aggregator = SpatialFeatureAggregator()
