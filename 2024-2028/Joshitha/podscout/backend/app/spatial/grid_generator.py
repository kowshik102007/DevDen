"""
Adaptive Grid Generator for Spatial Normalization

Creates multi-resolution grid cells based on population density:
- Urban areas (high density): 500m × 500m cells
- Suburban areas (medium): 1000m × 1000m cells
- Rural areas (low density): 2000m × 2000m cells
"""

from typing import List, Dict, Tuple
import logging
from datetime import datetime
import math

from ..services.supabase import get_supabase

logger = logging.getLogger(__name__)

# Grid level configurations
GRID_CONFIGS = {
    1: {"name": "urban", "size_meters": 500, "pop_threshold": 10000},
    2: {"name": "suburban", "size_meters": 1000, "pop_threshold": 2000},
    3: {"name": "rural", "size_meters": 2000, "pop_threshold": 0}
}


class AdaptiveGridGenerator:
    """Generate adaptive multi-resolution grids for cities."""
    
    def __init__(self):
        self.supabase = get_supabase()
    
    async def generate_city_grid(
        self,
        city: str,
        bbox: List[float],
        population_data: Dict[Tuple[float, float], int] = None
    ) -> Dict[str, any]:
        """
        Generate adaptive grid for a city.
        
        Args:
            city: City name
            bbox: Bounding box [min_lon, min_lat, max_lon, max_lat]
            population_data: Optional dict mapping (lat, lon) to population density
        
        Returns:
            Summary of generated grid
        """
        logger.info(f"🗺️  Generating adaptive grid for {city}")
        
        min_lon, min_lat, max_lon, max_lat = bbox
        
        # Generate cells at different resolutions
        cells_created = 0
        node_id = 0
        
        cells = []
        
        # Iterate over grid
        lat = min_lat
        while lat < max_lat:
            lon = min_lon
            while lon < max_lon:
                # Determine grid level based on population
                pop_density = self._get_population_density(
                    lat, lon, population_data
                )
                level, cell_size = self._classify_cell_level(pop_density)
                
                # Create cell
                cell = self._create_cell(
                    city=city,
                    center_lat=lat,
                    center_lon=lon,
                    level=level,
                    cell_size=cell_size,
                    node_id=node_id,
                    pop_density=pop_density
                )
                
                cells.append(cell)
                node_id += 1
                
                # Advance longitude by cell size
                lon += self._meters_to_degrees_lon(cell_size, lat)
            
            # Advance latitude by cell size
            # Use minimum cell size for consistent coverage
            lat += self._meters_to_degrees_lat(GRID_CONFIGS[1]["size_meters"])
        
        logger.info(f"  Generated {len(cells)} cells")
        
        # Calculate neighbor relationships
        logger.info(f"  Calculating neighbor relationships...")
        self._calculate_neighbors(cells)
        
        # Store in database
        if self.supabase:
            logger.info(f"  Storing cells in database...")
            cells_created = await self._store_cells(cells)
        
        return {
            "city": city,
            "cells_generated": len(cells),
            "cells_stored": cells_created,
            "levels": {
                "urban": len([c for c in cells if c["grid_level"] == 1]),
                "suburban": len([c for c in cells if c["grid_level"] == 2]),
                "rural": len([c for c in cells if c["grid_level"] == 3])
            }
        }
    
    def _get_population_density(
        self,
        lat: float,
        lon: float,
        population_data: Dict = None
    ) -> int:
        """
        Get population density for a location.
        
        In production, would query from GHS-POP or similar dataset.
        For now, use city-center distance heuristic.
        """
        if population_data:
            # Round to nearest grid point
            key = (round(lat, 3), round(lon, 3))
            return population_data.get(key, 0)
        
        # Simple heuristic: assume density decreases from city center
        # This is placeholder - real implementation would use actual population data
        return 5000  # Medium density as default
    
    def _classify_cell_level(self, pop_density: int) -> Tuple[int, int]:
        """
        Classify cell level based on population density.
        
        Returns:
            (grid_level, cell_size_meters)
        """
        if pop_density >= GRID_CONFIGS[1]["pop_threshold"]:
            return 1, GRID_CONFIGS[1]["size_meters"]  # Urban
        elif pop_density >= GRID_CONFIGS[2]["pop_threshold"]:
            return 2, GRID_CONFIGS[2]["size_meters"]  # Suburban
        else:
            return 3, GRID_CONFIGS[3]["size_meters"]  # Rural
    
    def _create_cell(
        self,
        city: str,
        center_lat: float,
        center_lon: float,
        level: int,
        cell_size: int,
        node_id: int,
        pop_density: int
    ) -> Dict:
        """Create a grid cell with geometry."""
        
        # Calculate cell bounds
        half_size_lat = self._meters_to_degrees_lat(cell_size / 2)
        half_size_lon = self._meters_to_degrees_lon(cell_size / 2, center_lat)
        
        min_lat = center_lat - half_size_lat
        max_lat = center_lat + half_size_lat
        min_lon = center_lon - half_size_lon
        max_lon = center_lon + half_size_lon
        
        # Create cell ID
        cell_id = f"grid_{center_lat:.4f}_{center_lon:.4f}_L{level}"
        
        # WKT polygon for PostGIS
        wkt_polygon = f"POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, {max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat}))"
        
        return {
            "id": cell_id,
            "city": city,
            "center_lat": center_lat,
            "center_lon": center_lon,
            "cell_size_meters": cell_size,
            "grid_level": level,
            "gnn_node_id": node_id,
            "population_density": pop_density,
            "cell_wkt": wkt_polygon,
            "neighbor_cell_ids": [],  # Calculated later
            "neighbor_node_ids": []
        }
    
    def _calculate_neighbors(self, cells: List[Dict]):
        """Calculate K-nearest neighbors for each cell."""
        logger.info(f"    Calculating neighbors for {len(cells)} cells...")
        
        for i, cell in enumerate(cells):
            # Find K nearest neighbors (K=8 for grid)
            neighbors = []
            
            for j, other_cell in enumerate(cells):
                if i == j:
                    continue
                
                # Calculate distance
                dist = self._haversine_distance(
                    cell["center_lat"], cell["center_lon"],
                    other_cell["center_lat"], other_cell["center_lon"]
                )
                
                neighbors.append((j, other_cell["id"], other_cell["gnn_node_id"], dist))
            
            # Sort by distance and take top 8
            neighbors.sort(key=lambda x: x[3])
            neighbors = neighbors[:8]
            
            # Store neighbor IDs
            cell["neighbor_cell_ids"] = [n[1] for n in neighbors]
            cell["neighbor_node_ids"] = [n[2] for n in neighbors]
    
    def _haversine_distance(
        self,
        lat1: float, lon1: float,
        lat2: float, lon2: float
    ) -> float:
        """Calculate Haversine distance between two points in meters."""
        R = 6371000  # Earth radius in meters
        
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_phi / 2) ** 2 +
             math.cos(phi1) * math.cos(phi2) *
             math.sin(delta_lambda / 2) ** 2)
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _meters_to_degrees_lat(self, meters: float) -> float:
        """Convert meters to degrees latitude."""
        return meters / 111320.0  # 1 degree ≈ 111.32 km
    
    def _meters_to_degrees_lon(self, meters: float, latitude: float) -> float:
        """Convert meters to degrees longitude at given latitude."""
        return meters / (111320.0 * math.cos(math.radians(latitude)))
    
    async def _store_cells(self, cells: List[Dict]) -> int:
        """Store cells in Supabase database."""
        if not self.supabase:
            logger.warning("Supabase not configured")
            return 0
        
        stored = 0
        
        for cell in cells:
            try:
                # Prepare data for database
                cell_data = {
                    "id": cell["id"],
                    "city": cell["city"],
                    "center_lat": cell["center_lat"],
                    "center_lon": cell["center_lon"],
                    "cell_size_meters": cell["cell_size_meters"],
                    "grid_level": cell["grid_level"],
                    "gnn_node_id": cell["gnn_node_id"],
                    "population_density": cell["population_density"],
                    "neighbor_cell_ids": cell["neighbor_cell_ids"],
                    "neighbor_node_ids": cell["neighbor_node_ids"],
                    "created_at": datetime.utcnow().isoformat()
                }
                
                # Insert cell
                # Note: cell_geom would be set via PostGIS function in production
                self.supabase.table("grid_cells").upsert(cell_data).execute()
                stored += 1
                
            except Exception as e:
                logger.error(f"Error storing cell {cell['id']}: {e}")
        
        logger.info(f"  ✓ Stored {stored}/{len(cells)} cells")
        return stored


# Global instance
grid_generator = AdaptiveGridGenerator()
