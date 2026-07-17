"""
Population and Land Cover ingestion.
Sources: 
- WorldPop (Population Density)
- ESA WorldCover (Land Use)
"""
try:
    import ee
    EE_AVAILABLE = True
except ImportError:
    EE_AVAILABLE = False
    ee = None

from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
from ..config import settings

logger = logging.getLogger(__name__)

class LandPopIngestion:
    """Ingest Population and Land Cover data."""
    
    def __init__(self):
        """Initialize Earth Engine."""
        self.initialized = False
        try:
            from backend.app.utils.ee_auth import initialize_ee
            self.initialized = initialize_ee()
        except Exception as e:
            logger.warning(f"LandPop Earth Engine initialization deferred: {e}")

    def fetch_data(
        self,
        bbox: List[float],
        grid_size: float = 0.01
    ) -> List[Dict[str, Any]]:
        """
        Fetch Population and Land Cover for a bounding box.
        """
        if not self.initialized:
            raise RuntimeError("Earth Engine not initialized")
        
        try:
            roi = ee.Geometry.Rectangle(bbox)
            
            # 1. WorldPop (Population) - Use latest available year
            pop_col = ee.ImageCollection("WorldPop/GP/100m/pop") \
                .filterBounds(roi) \
                .filterDate('2020-01-01', '2025-01-01') \
                .select('population')
            
            # Mosaic to get single image
            pop_img = pop_col.mosaic().setDefaultProjection('EPSG:4326', None, 100)
            
            # 2. ESA WorldCover (Land Use) - 2021
            wc_col = ee.ImageCollection("ESA/WorldCover/v200").first()
            wc_img = wc_col.select('Map')
            
            # Combine
            combined = pop_img.addBands(wc_img)
            
            # Sample on grid
            grid = self._create_sample_grid(bbox, grid_size)
            samples = combined.sampleRegions(
                collection=grid,
                scale=100,  # 100m resolution
                geometries=True
            )
            
            features = samples.getInfo()['features']
            
            results = []
            
            # ESA WorldCover Mapping
            # 10: Tree cover, 20: Shrubland, 30: Grassland, 40: Cropland, 50: Built-up, 
            # 60: Bare / sparse vegetation, 70: Snow and ice, 80: Permanent water bodies, 
            # 90: Herbaceous wetland, 95: Mangroves, 100: Moss and lichen
            
            land_use_map = {
                10: 'Tree cover', 20: 'Shrubland', 30: 'Grassland', 40: 'Cropland', 
                50: 'Built-up', 60: 'Bare / sparse', 70: 'Snow and ice', 
                80: 'Water bodies', 90: 'Wetland', 95: 'Mangroves', 100: 'Moss/Lichen'
            }
            
            for feature in features:
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                res = {
                    'lat': coords[1],
                    'lon': coords[0],
                    'source': 'worldpop_esa'
                }
                
                if 'population' in props:
                    res['population_density'] = props['population']
                
                if 'Map' in props:
                    res['land_use_code'] = props['Map']
                    res['land_use_type'] = land_use_map.get(props['Map'], 'Unknown')
                
                results.append(res)
            
            logger.info(f"Fetched {len(results)} Pop/Land measurements")
            return results
            
        except Exception as e:
            logger.error(f"Error fetching LandPop data: {e}")
            return []

    def _create_sample_grid(self, bbox: List[float], grid_size: float) -> Any:
        min_lon, min_lat, max_lon, max_lat = bbox
        points = []
        lon = min_lon
        while lon <= max_lon:
            lat = min_lat
            while lat <= max_lat:
                points.append(ee.Feature(ee.Geometry.Point([lon, lat])))
                lat += grid_size
            lon += grid_size
        return ee.FeatureCollection(points)

land_pop = LandPopIngestion()
