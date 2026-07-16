"""
Sentinel-5P TROPOMI data ingestion for NO2 and SO2.
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


class Sentinel5PIngestion:
    """Ingest Sentinel-5P TROPOMI data via Google Earth Engine."""
    
    def __init__(self):
        """Initialize Earth Engine."""
        self.initialized = False
        try:
            from backend.app.utils.ee_auth import initialize_ee
            self.initialized = initialize_ee()
        except Exception as e:
            logger.warning(f"Earth Engine initialization deferred: {e}")
    
    # _initialize_ee removed, using unified util

    def fetch_point_data(
        self,
        lat: float,
        lon: float,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch data for a specific point.
        """
        if not self.initialized:
             # Try lazy init
            from backend.app.utils.ee_auth import initialize_ee
            if initialize_ee():
                self.initialized = True
            else:
                return {"error": "Earth Engine not initialized"}

        if not start_date:
            start_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
            
        try:
            point = ee.Geometry.Point([lon, lat])
            
            # NO2
            no2_col = (
                ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2')
                .filterBounds(point)
                .filterDate(start_date, end_date)
                .select('tropospheric_NO2_column_number_density')
            )
            no2_val = no2_col.mean().reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=point,
                scale=1000
            ).getInfo()
            
            # SO2
            so2_col = (
                ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_SO2')
                .filterBounds(point)
                .filterDate(start_date, end_date)
                .select('SO2_column_number_density')
            )
            so2_val = so2_col.mean().reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=point,
                scale=1000
            ).getInfo()
            
            return {
                "lat": lat,
                "lon": lon,
                "no2": no2_val.get('tropospheric_NO2_column_number_density'),
                "so2": so2_val.get('SO2_column_number_density'),
                "start_date": start_date,
                "end_date": end_date,
                "source": "sentinel5p"
            }
        except Exception as e:
            logger.error(f"Error fetching point data: {e}")
            return {"error": str(e)}
    
    def fetch_no2(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        grid_size: float = 0.01
    ) -> List[Dict[str, Any]]:
        """
        Fetch NO2 data from Sentinel-5P.
        
        Args:
            bbox: [min_lon, min_lat, max_lon, max_lat]
            start_date: ISO format date (e.g., '2026-01-01')
            end_date: ISO format date
            grid_size: Grid cell size in degrees (~1km at equator)
        
        Returns:
            List of measurements with lat, lon, no2_value, timestamp
        """
        if not self.initialized:
            raise RuntimeError("Earth Engine not initialized")
        
        try:
            # Define region of interest
            roi = ee.Geometry.Rectangle(bbox)
            
            # Load Sentinel-5P NO2 collection
            collection = (
                ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2')
                .filterBounds(roi)
                .filterDate(start_date, end_date)
                .select('tropospheric_NO2_column_number_density')
            )
            
            # Compute mean NO2 over period
            no2_mean = collection.mean()
            
            # Sample on grid
            grid = self._create_sample_grid(bbox, grid_size)
            samples = no2_mean.sampleRegions(
                collection=grid,
                scale=1000,  # 1km resolution
                geometries=True
            )
            
            # Convert to Python list
            features = samples.getInfo()['features']
            
            results = []
            for feature in features:
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                if 'tropospheric_NO2_column_number_density' in props:
                    results.append({
                        'lat': coords[1],
                        'lon': coords[0],
                        'no2': props['tropospheric_NO2_column_number_density'],
                        'start_date': start_date,
                        'end_date': end_date,
                        'source': 'sentinel5p'
                    })
            
            logger.info(f"Fetched {len(results)} NO2 measurements")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching NO2 data: {e}")
            return []
    
    def fetch_so2(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        grid_size: float = 0.01
    ) -> List[Dict[str, Any]]:
        """
        Fetch SO2 data from Sentinel-5P.
        """
        if not self.initialized:
            raise RuntimeError("Earth Engine not initialized")
        
        try:
            roi = ee.Geometry.Rectangle(bbox)
            
            collection = (
                ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_SO2')
                .filterBounds(roi)
                .filterDate(start_date, end_date)
                .select('SO2_column_number_density')
            )
            
            so2_mean = collection.mean()
            grid = self._create_sample_grid(bbox, grid_size)
            samples = so2_mean.sampleRegions(
                collection=grid,
                scale=1000,
                geometries=True
            )
            
            features = samples.getInfo()['features']
            
            results = []
            for feature in features:
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                if 'SO2_column_number_density' in props:
                    results.append({
                        'lat': coords[1],
                        'lon': coords[0],
                        'so2': props['SO2_column_number_density'],
                        'start_date': start_date,
                        'end_date': end_date,
                        'source': 'sentinel5p'
                    })
            
            logger.info(f"Fetched {len(results)} SO2 measurements")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching SO2 data: {e}")
            return []

    def fetch_co(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        grid_size: float = 0.01
    ) -> List[Dict[str, Any]]:
        """
        Fetch CO data from Sentinel-5P.
        """
        if not self.initialized:
            raise RuntimeError("Earth Engine not initialized")
        
        try:
            roi = ee.Geometry.Rectangle(bbox)
            
            collection = (
                ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CO')
                .filterBounds(roi)
                .filterDate(start_date, end_date)
                .select('CO_column_number_density')
            )
            
            co_mean = collection.mean()
            grid = self._create_sample_grid(bbox, grid_size)
            samples = co_mean.sampleRegions(
                collection=grid,
                scale=1000,
                geometries=True
            )
            
            features = samples.getInfo()['features']
            
            results = []
            for feature in features:
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                if 'CO_column_number_density' in props:
                    results.append({
                        'lat': coords[1],
                        'lon': coords[0],
                        'co': props['CO_column_number_density'],
                        'start_date': start_date,
                        'end_date': end_date,
                        'source': 'sentinel5p'
                    })
            
            logger.info(f"Fetched {len(results)} CO measurements")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching CO data: {e}")
            return []

    def fetch_o3(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        grid_size: float = 0.01
    ) -> List[Dict[str, Any]]:
        """
        Fetch O3 (Ozone) data from Sentinel-5P.
        """
        if not self.initialized:
            raise RuntimeError("Earth Engine not initialized")
        
        try:
            roi = ee.Geometry.Rectangle(bbox)
            
            collection = (
                ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_O3')
                .filterBounds(roi)
                .filterDate(start_date, end_date)
                .select('O3_column_number_density')
            )
            
            o3_mean = collection.mean()
            grid = self._create_sample_grid(bbox, grid_size)
            samples = o3_mean.sampleRegions(
                collection=grid,
                scale=1000,
                geometries=True
            )
            
            features = samples.getInfo()['features']
            
            results = []
            for feature in features:
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                if 'O3_column_number_density' in props:
                    results.append({
                        'lat': coords[1],
                        'lon': coords[0],
                        'o3': props['O3_column_number_density'],
                        'start_date': start_date,
                        'end_date': end_date,
                        'source': 'sentinel5p'
                    })
            
            logger.info(f"Fetched {len(results)} O3 measurements")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching O3 data: {e}")
            return []
    
    def _create_sample_grid(
        self,
        bbox: List[float],
        grid_size: float
    ) -> Any:  # ee.FeatureCollection when available
        """Create a sampling grid within bounding box."""
        if not EE_AVAILABLE or not self.initialized:
            return None
        
        min_lon, min_lat, max_lon, max_lat = bbox
        
        # Generate grid points
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
        days_back: int = 7
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch recent data for a city — NO2, SO2, CO and O3.

        Args:
            city_bbox: {'city_name': [min_lon, min_lat, max_lon, max_lat]}
            days_back: Number of days to fetch

        Returns:
            {'no2': [...], 'so2': [...], 'co': [...], 'o3': [...]}
        """
        end_date   = datetime.now()
        start_date = end_date - timedelta(days=days_back)

        results: Dict[str, List[Dict[str, Any]]] = {
            'no2': [], 'so2': [], 'co': [], 'o3': []
        }

        start_str = start_date.strftime('%Y-%m-%d')
        end_str   = end_date.strftime('%Y-%m-%d')

        for city_name, bbox in city_bbox.items():
            logger.info(f"Fetching Sentinel-5P data for {city_name}")

            for pollutant in ('no2', 'so2', 'co', 'o3'):
                fetch_fn = getattr(self, f'fetch_{pollutant}', None)
                if fetch_fn is None:
                    logger.warning("No fetch method for %s — skipping", pollutant)
                    continue
                try:
                    records = fetch_fn(bbox, start_str, end_str)
                    for record in records:
                        record['city'] = city_name
                    results[pollutant].extend(records)
                except Exception as e:
                    logger.error("Error fetching %s for %s: %s", pollutant, city_name, e)

        return results


# Convenience instance
sentinel5p = Sentinel5PIngestion()
