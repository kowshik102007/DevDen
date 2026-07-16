"""
Landsat 8/9 Land Surface Temperature (LST) ingestion.
Source: Google Earth Engine
"""
try:
    import ee
    EE_AVAILABLE = True
except ImportError:
    EE_AVAILABLE = False
    ee = None

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from ..config import settings
import logging

logger = logging.getLogger(__name__)


class LandsatLSTIngestion:
    """Ingest Landsat 8/9 Land Surface Temperature."""
    
    def __init__(self):
        """Initialize Earth Engine."""
        self.initialized = False
        try:
            from backend.app.utils.ee_auth import initialize_ee
            self.initialized = initialize_ee()
        except Exception as e:
            logger.warning(f"Landsat Earth Engine initialization deferred: {e}")
            
    # _initialize_ee removed, using unified util

    def fetch_lst_point(
        self,
        lat: float,
        lon: float,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch LST for a single point."""
        if not self.initialized:
             # Lazy init attempt not needed if forced externally, but handling just in case
             return {"error": "Earth Engine not initialized"}
             
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
            
        try:
            point = ee.Geometry.Point([lon, lat])
            
            # Landsat 8/9
            l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').filterBounds(point).filterDate(start_date, end_date)
            l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2').filterBounds(point).filterDate(start_date, end_date)
            combined = l8.merge(l9)
            
            # Helper to extract LST
            def get_lst(img):
                thermal = img.select('ST_B10')
                lst = thermal.multiply(0.00341802).add(149.0).subtract(273.15)
                return img.addBands(lst.rename('LST'))
            
            lst_col = combined.map(get_lst).select('LST')
            
            # Get mean
            val_dict = lst_col.mean().reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=point,
                scale=30
            ).getInfo()
            
            temp_c = val_dict.get('LST')
            
            # Convert back to Kelvin for consistency with my previous assumption, or just return C
            # Previous script expected Kelvin and converted. I should return Kelvin to match expectation 
            # OR update the script.
            # Updating script to expect Kelvin is safer or I change script to expect Celsius.
            # Script does: temp_c = temp_k - 273.15. So I should return Kelvin.
            
            temp_k = (temp_c + 273.15) if temp_c is not None else 0.0
            
            return {
                "lat": lat,
                "lon": lon,
                "temperature_k": temp_k,
                "start_date": start_date,
                "end_date": end_date
            }
            
        except Exception as e:
            logger.error(f"Error fetching LST point: {e}")
            return {"error": str(e)}
    
    def fetch_lst(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        grid_size: float = 0.01
    ) -> List[Dict[str, Any]]:
        """
        Fetch Land Surface Temperature from Landsat 8/9.
        
        Args:
            bbox: [min_lon, min_lat, max_lon, max_lat]
            start_date: ISO format date
            end_date: ISO format date
            grid_size: Grid cell size in degrees
        
        Returns:
            List of LST measurements in Celsius
        """
        if not self.initialized:
            raise RuntimeError("Earth Engine not initialized")
        
        try:
            roi = ee.Geometry.Rectangle(bbox)
            
            # Landsat 8 Collection 2 Tier 1
            landsat8 = (
                ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filterBounds(roi)
                .filterDate(start_date, end_date)
            )
            
            # Landsat 9 Collection 2 Tier 1  
            landsat9 = (
                ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
                .filterBounds(roi)
                .filterDate(start_date, end_date)
            )
            
            # Merge collections
            combined = landsat8.merge(landsat9)
            
            # Apply LST calculation function
            lst_collection = combined.map(self._calculate_lst)
            
            # Compute mean LST
            lst_mean = lst_collection.select('LST').mean()
            
            # Sample on grid
            grid = self._create_sample_grid(bbox, grid_size)
            samples = lst_mean.sampleRegions(
                collection=grid,
                scale=30,  # Landsat resolution
                geometries=True
            )
            
            features = samples.getInfo()['features']
            
            results = []
            for feature in features:
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                if 'LST' in props and props['LST'] is not None:
                    results.append({
                        'lat': coords[1],
                        'lon': coords[0],
                        'lst_celsius': props['LST'],
                        'start_date': start_date,
                        'end_date': end_date,
                        'source': 'landsat8_9'
                    })
            
            logger.info(f"Fetched {len(results)} LST measurements")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching LST data: {e}")
            return []
    
    def _calculate_lst(self, image):
        """
        Calculate Land Surface Temperature from Landsat thermal band.
        
        Converts from Digital Numbers to Celsius.
        """
        # Landsat Collection 2 thermal band (ST_B10)
        thermal = image.select('ST_B10')
        
        # Apply scaling factors (Collection 2)
        lst_kelvin = thermal.multiply(0.00341802).add(149.0)
        
        # Convert to Celsius
        lst_celsius = lst_kelvin.subtract(273.15)
        
        return image.addBands(lst_celsius.rename('LST'))
    
    def _create_sample_grid(
        self,
        bbox: List[float],
        grid_size: float
    ) -> Any:  # ee.FeatureCollection when available
        """Create sampling grid."""
        if not EE_AVAILABLE or not self.initialized:
            return None
        
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
    
    def fetch_daily_data(
        self,
        city_bbox: Dict[str, List[float]],
        days_back: int = 16  # Landsat revisit period
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent LST data for cities.
        
        Args:
            city_bbox: {'city_name': [min_lon, min_lat, max_lon, max_lat]}
            days_back: Number of days (default 16 for Landsat cycle)
        
        Returns:
            List of LST measurements
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        results = []
        
        for city_name, bbox in city_bbox.items():
            logger.info(f"Fetching LST for {city_name}")
            
            lst_data = self.fetch_lst(
                bbox,
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )
            
            for record in lst_data:
                record['city'] = city_name
            
            results.extend(lst_data)
        
        return results


# Convenience instance
landsat_lst = LandsatLSTIngestion()
