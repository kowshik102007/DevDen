"""
CPCB (Central Pollution Control Board) India ground sensor data ingestion.

Note: The official CPCB API requires special access. This module includes:
1. Official API support (when credentials available)
2. Fallback to OpenAQ for CPCB station data
3. Redis caching to reduce API calls
"""
import httpx
from typing import Dict, Any, List, Optional
from datetime import datetime
from ..config import settings
from ..services.redis_client import RedisClient
import logging
import asyncio

logger = logging.getLogger(__name__)


class CPCBIngestion:
    """Ingest ground sensor data from CPCB India with caching and fallback."""
    
    # Official CPCB API (requires registration)
    BASE_URL = "https://api.cpcb.gov.in/aqi/v1.0"
    
    # Fallback: Known CPCB station locations in major cities
    KNOWN_STATIONS = {
        'Delhi': [
            {'id': 'CPCB_DEL_001', 'name': 'Anand Vihar', 'lat': 28.6508, 'lon': 77.3152},
            {'id': 'CPCB_DEL_002', 'name': 'ITO', 'lat': 28.6289, 'lon': 77.2415},
            {'id': 'CPCB_DEL_003', 'name': 'Dwarka', 'lat': 28.5921, 'lon': 77.0460},
            {'id': 'CPCB_DEL_004', 'name': 'Punjabi Bagh', 'lat': 28.6683, 'lon': 77.1167},
        ],
        'Mumbai': [
            {'id': 'CPCB_MUM_001', 'name': 'Bandra', 'lat': 19.0596, 'lon': 72.8295},
            {'id': 'CPCB_MUM_002', 'name': 'Colaba', 'lat': 18.9067, 'lon': 72.8147},
        ],
        'Bangalore': [
            {'id': 'CPCB_BLR_001', 'name': 'BTM Layout', 'lat': 12.9165, 'lon': 77.6101},
            {'id': 'CPCB_BLR_002', 'name': 'Peenya', 'lat': 13.0308, 'lon': 77.5219},
        ],
        'Chennai': [
            {'id': 'CPCB_CHE_001', 'name': 'Alandur', 'lat': 13.0025, 'lon': 80.2051},
        ],
        'Kolkata': [
            {'id': 'CPCB_KOL_001', 'name': 'Victoria Memorial', 'lat': 22.5448, 'lon': 88.3426},
        ],
    }
    
    def __init__(self):
        """Initialize CPCB client."""
        self.api_key = settings.CPCB_API_KEY
        self.has_api_access = bool(self.api_key)
        
        headers = {
            'User-Agent': 'PodScout-Pro/1.0',
            'Accept': 'application/json',
        }
        self.client = httpx.AsyncClient(timeout=30.0, headers=headers)
        
        if self.has_api_access:
            logger.info("CPCB client initialized with API key")
        else:
            logger.warning("CPCB API key not configured - using OpenAQ fallback for India data")
    
    def _get_cache_key(self, city: str) -> str:
        """Generate cache key for city data."""
        return RedisClient.generate_key('cpcb', city.lower())
    
    async def fetch_realtime_data(
        self,
        city: Optional[str] = None,
        state: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch real-time AQI and pollutant data from CPCB.
        
        Falls back to OpenAQ India data if CPCB API is not available.
        
        Args:
            city: Filter by city name (e.g., 'Delhi')
            state: Filter by state name (e.g., 'Delhi')
        
        Returns:
            List of station measurements
        """
        # Check cache first
        if city:
            cache_key = self._get_cache_key(city)
            cached = RedisClient.get(cache_key)
            if cached:
                logger.debug(f"CPCB cache hit for {city}")
                return cached
        
        results = []
        
        # Try official CPCB API first if we have access
        if self.has_api_access:
            results = await self._fetch_from_official_api(city, state)
        
        # Fallback to OpenAQ for India data
        if not results:
            results = await self._fetch_from_openaq_fallback(city)
        
        # Cache results
        if city and results:
            cache_key = self._get_cache_key(city)
            RedisClient.set(cache_key, results, prefix='cpcb')
        
        return results
    
    async def _fetch_from_official_api(
        self,
        city: Optional[str],
        state: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Try to fetch from official CPCB API."""
        try:
            params = {}
            if city:
                params['city'] = city
            if state:
                params['state'] = state
            if self.api_key:
                params['api_key'] = self.api_key
            
            response = await self.client.get(
                f"{self.BASE_URL}/realtime",
                params=params
            )
            
            if response.status_code != 200:
                logger.warning(f"CPCB API returned {response.status_code}")
                return []
            
            data = response.json()
            
            results = []
            for station in data.get('stations', []):
                results.append({
                    'station_id': station.get('id'),
                    'station_name': station.get('name'),
                    'city': station.get('city'),
                    'state': station.get('state'),
                    'lat': station.get('latitude'),
                    'lon': station.get('longitude'),
                    'pm25': station.get('pollutants', {}).get('PM2.5'),
                    'pm10': station.get('pollutants', {}).get('PM10'),
                    'no2': station.get('pollutants', {}).get('NO2'),
                    'so2': station.get('pollutants', {}).get('SO2'),
                    'co': station.get('pollutants', {}).get('CO'),
                    'o3': station.get('pollutants', {}).get('O3'),
                    'aqi': station.get('aqi'),
                    'aqi_category': station.get('aqi_category'),
                    'timestamp': station.get('timestamp', datetime.now().isoformat()),
                    'source': 'cpcb'
                })
            
            logger.info(f"Fetched {len(results)} stations from CPCB API")
            return results
            
        except Exception as e:
            logger.error(f"Error fetching from CPCB API: {e}")
            return []
    
    async def _fetch_from_openaq_fallback(
        self,
        city: Optional[str]
    ) -> List[Dict[str, Any]]:
        """
        Fallback: Get India data from OpenAQ (which includes CPCB stations).
        """
        try:
            # Import here to avoid circular dependency
            from .openaq import openaq
            
            # Get data for India
            measurements = await openaq.fetch_latest_measurements(
                country='IN',
                limit=200
            )
            
            if not measurements:
                return []
            
            # Filter by city if specified
            if city:
                city_lower = city.lower()
                measurements = [
                    m for m in measurements 
                    if m.get('city', '').lower() == city_lower
                ]
            
            # Transform to CPCB format
            # Group measurements by location
            locations = {}
            for m in measurements:
                loc_id = m.get('location_id')
                if loc_id not in locations:
                    locations[loc_id] = {
                        'station_id': f"openaq-{loc_id}",
                        'station_name': m.get('location_name'),
                        'city': m.get('city'),
                        'state': None,
                        'lat': m.get('lat'),
                        'lon': m.get('lon'),
                        'pm25': None,
                        'pm10': None,
                        'no2': None,
                        'so2': None,
                        'co': None,
                        'o3': None,
                        'timestamp': m.get('last_updated'),
                        'source': 'openaq_fallback'
                    }
                
                # Map parameter to field
                param = m.get('parameter', '').lower()
                value = m.get('value')
                
                if param == 'pm25':
                    locations[loc_id]['pm25'] = value
                elif param == 'pm10':
                    locations[loc_id]['pm10'] = value
                elif param == 'no2':
                    locations[loc_id]['no2'] = value
                elif param == 'so2':
                    locations[loc_id]['so2'] = value
                elif param == 'co':
                    locations[loc_id]['co'] = value
                elif param == 'o3':
                    locations[loc_id]['o3'] = value
            
            results = list(locations.values())
            logger.info(f"Fetched {len(results)} stations from OpenAQ fallback for CPCB")
            return results
            
        except Exception as e:
            logger.error(f"Error in OpenAQ fallback: {e}")
            return []
    
    async def fetch_historical_data(
        self,
        station_id: str,
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical data for a specific station.
        
        Note: Only available with official CPCB API access.
        """
        if not self.has_api_access:
            logger.warning("Historical data requires CPCB API access")
            return []
        
        try:
            params = {
                'station_id': station_id,
                'from_date': start_date,
                'to_date': end_date,
                'api_key': self.api_key
            }
            
            response = await self.client.get(
                f"{self.BASE_URL}/historical",
                params=params
            )
            response.raise_for_status()
            
            data = response.json()
            
            results = []
            for reading in data.get('readings', []):
                results.append({
                    'station_id': station_id,
                    'pm25': reading.get('PM2.5'),
                    'pm10': reading.get('PM10'),
                    'no2': reading.get('NO2'),
                    'so2': reading.get('SO2'),
                    'timestamp': reading.get('timestamp'),
                    'source': 'cpcb'
                })
            
            logger.info(f"Fetched {len(results)} historical records for {station_id}")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching historical CPCB data: {e}")
            return []
    
    async def list_stations(
        self,
        city: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List all available monitoring stations.
        
        Uses known stations list if API not available.
        """
        if self.has_api_access:
            try:
                params = {'api_key': self.api_key}
                if city:
                    params['city'] = city
                
                response = await self.client.get(
                    f"{self.BASE_URL}/stations",
                    params=params
                )
                response.raise_for_status()
                
                data = response.json()
                return data.get('stations', [])
            
            except Exception as e:
                logger.error(f"Error listing CPCB stations: {e}")
        
        # Fallback to known stations
        if city:
            return self.KNOWN_STATIONS.get(city, [])
        
        # Return all known stations
        all_stations = []
        for city_stations in self.KNOWN_STATIONS.values():
            all_stations.extend(city_stations)
        return all_stations
    
    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
    
    def clear_cache(self) -> int:
        """Clear CPCB cache."""
        return RedisClient.invalidate_cache('cpcb')


# Convenience instance
cpcb = CPCBIngestion()
