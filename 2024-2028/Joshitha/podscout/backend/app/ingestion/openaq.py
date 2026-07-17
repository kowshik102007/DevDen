"""
OpenAQ global air quality data ingestion.
Source: OpenAQ API v3
"""
import httpx
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from ..config import settings
from ..services.redis_client import RedisClient, cached
import logging
import asyncio

logger = logging.getLogger(__name__)


class OpenAQIngestion:
    """Ingest global air quality data from OpenAQ v3."""
    
    BASE_URL = "https://api.openaq.org/v3"
    
    def __init__(self):
        """Initialize OpenAQ client with proper headers."""
        self.api_key = settings.OPENAQ_API_KEY
        
        # User-Agent is REQUIRED by OpenAQ v3 API
        headers = {
            'User-Agent': 'PodScout-Pro/1.0 (https://github.com/podscout; contact@podscout.ai)',
            'Accept': 'application/json',
        }
        
        if self.api_key:
            headers['X-API-Key'] = self.api_key
            logger.info("OpenAQ client initialized with API key")
        else:
            logger.warning("OpenAQ API key not configured - rate limits will apply")
        
        self.client = httpx.AsyncClient(timeout=30.0, headers=headers)
        self._retry_count = 3
        self._retry_delay = 1.0  # seconds
    
    async def _request_with_retry(
        self,
        url: str,
        params: Dict[str, Any],
        method: str = "GET"
    ) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request with retry logic.
        
        Args:
            url: Full URL to request
            params: Query parameters
            method: HTTP method
        
        Returns:
            JSON response or None if failed
        """
        last_error = None
        
        for attempt in range(self._retry_count):
            try:
                response = await self.client.get(url, params=params)
                
                # Handle specific error codes
                if response.status_code == 401:
                    logger.error("OpenAQ 401 Unauthorized - Check your API key")
                    logger.error(f"Response: {response.text[:500]}")
                    return None
                
                if response.status_code == 403:
                    logger.error("OpenAQ 403 Forbidden - API key may be invalid")
                    return None
                
                if response.status_code == 429:
                    # Rate limited - wait and retry
                    wait_time = self._retry_delay * (2 ** attempt)
                    logger.warning(f"OpenAQ rate limited. Waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)
                    continue
                
                if response.status_code != 200:
                    logger.warning(f"OpenAQ returned {response.status_code}: {response.text[:200]}")
                    return None
                
                return response.json()
                
            except httpx.TimeoutException:
                logger.warning(f"OpenAQ request timeout (attempt {attempt + 1}/{self._retry_count})")
                last_error = "timeout"
                await asyncio.sleep(self._retry_delay * (2 ** attempt))
                
            except Exception as e:
                logger.error(f"OpenAQ request error: {e}")
                last_error = str(e)
                await asyncio.sleep(self._retry_delay)
        
        logger.error(f"OpenAQ request failed after {self._retry_count} attempts: {last_error}")
        return None
    
    async def fetch_latest_measurements(
        self,
        city: Optional[str] = None,
        country: Optional[str] = None,
        bbox: Optional[List[float]] = None,
        limit: int = 100,
        parameter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch latest measurements from OpenAQ v3.
        
        Args:
            city: Filter by city name
            country: Filter by country code (e.g., 'IN' for India)
            bbox: Bounding box [min_lon, min_lat, max_lon, max_lat]
            limit: Maximum results
            parameter: Filter by parameter (e.g., 'pm25', 'pm10', 'no2')
        
        Returns:
            List of latest measurements
        """
        try:
            # v3 uses /locations endpoint with sensors/latest
            params = {
                'limit': limit,
            }
            
            if country:
                # v3 uses ISO country codes directly
                params['countries'] = country
            if bbox:
                # v3 bbox format: coordinates=lat,lon and radius
                center_lat = (bbox[1] + bbox[3]) / 2
                center_lon = (bbox[0] + bbox[2]) / 2
                params['coordinates'] = f"{center_lat},{center_lon}"
                # Calculate approximate radius from bbox
                lat_diff = abs(bbox[3] - bbox[1])
                lon_diff = abs(bbox[2] - bbox[0])
                radius_km = max(lat_diff, lon_diff) * 111 / 2  # degrees to km
                params['radius'] = int(radius_km * 1000)  # meters
            
            data = await self._request_with_retry(
                f"{self.BASE_URL}/locations",
                params
            )
            
            if not data:
                return []
            
            results = []
            for location in data.get('results', []):
                coords = location.get('coordinates', {})
                
                # Get sensor data
                for sensor in location.get('sensors', []):
                    param = sensor.get('parameter', {})
                    param_name = param.get('name', 'unknown').lower()
                    
                    # Filter by parameter if specified
                    if parameter and param_name != parameter.lower():
                        continue
                    
                    latest = sensor.get('latest', {})
                    
                    if latest and latest.get('value') is not None:
                        results.append({
                            'location_id': location.get('id'),
                            'location_name': location.get('name'),
                            'city': location.get('locality') or location.get('name'),
                            'country': location.get('country', {}).get('code'),
                            'lat': coords.get('latitude'),
                            'lon': coords.get('longitude'),
                            'parameter': param_name,
                            'value': latest.get('value'),
                            'unit': param.get('units'),
                            'last_updated': latest.get('datetime', {}).get('utc'),
                            'source': 'openaq_v3'
                        })
            
            # Log breakdown by parameter
            pm25_count = len([r for r in results if r['parameter'] == 'pm25'])
            logger.info(f"Fetched {len(results)} OpenAQ v3 measurements ({pm25_count} PM2.5)")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching OpenAQ v3 data: {e}")
            return []
    
    async def fetch_measurements(
        self,
        location_id: Optional[int] = None,
        parameter: Optional[str] = None,
        city: Optional[str] = None,
        country: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical measurements.
        
        Args:
            location_id: Specific location ID
            parameter: Pollutant type (pm25, pm10, no2, so2, o3, co)
            city: City name
            country: Country code
            date_from: Start date (ISO format)
            date_to: End date (ISO format)
            limit: Maximum results
        
        Returns:
            List of measurements
        """
        try:
            params = {'limit': limit}
            
            if location_id:
                params['location_id'] = location_id
            if parameter:
                params['parameter'] = parameter
            if city:
                params['city'] = city
            if country:
                params['country'] = country
            if date_from:
                params['date_from'] = date_from
            if date_to:
                params['date_to'] = date_to
            
            response = await self.client.get(
                f"{self.BASE_URL}/measurements",
                params=params
            )
            response.raise_for_status()
            
            data = response.json()
            
            results = []
            for result in data.get('results', []):
                results.append({
                    'location_id': result.get('locationId'),
                    'location_name': result.get('location'),
                    'city': result.get('city'),
                    'country': result.get('country'),
                    'lat': result['coordinates']['latitude'],
                    'lon': result['coordinates']['longitude'],
                    'parameter': result['parameter'],
                    'value': result['value'],
                    'unit': result['unit'],
                    'timestamp': result['date']['utc'],
                    'source': 'openaq'
                })
            
            logger.info(f"Fetched {len(results)} OpenAQ historical measurements")
            return results
        
        except Exception as e:
            logger.error(f"Error fetching OpenAQ measurements: {e}")
            return []
    
    async def list_locations(
        self,
        city: Optional[str] = None,
        country: Optional[str] = None,
        bbox: Optional[List[float]] = None
    ) -> List[Dict[str, Any]]:
        """
        List available monitoring locations.
        
        Args:
            city: Filter by city
            country: Filter by country code
            bbox: Bounding box filter
        
        Returns:
            List of location metadata
        """
        try:
            params = {'limit': 1000}
            
            if city:
                params['city'] = city
            if country:
                params['country'] = country
            if bbox:
                params['bbox'] = ','.join(map(str, bbox))
            
            response = await self.client.get(
                f"{self.BASE_URL}/locations",
                params=params
            )
            response.raise_for_status()
            
            data = response.json()
            return data.get('results', [])
        
        except Exception as e:
            logger.error(f"Error listing OpenAQ locations: {e}")
            return []
    
    async def fetch_recent_pm25(
        self,
        bbox: List[float],
        hours_back: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Convenience method to fetch recent PM2.5 data for a region.
        
        Args:
            bbox: Bounding box
            hours_back: How many hours of data to fetch
        
        Returns:
            PM2.5 measurements
        """
        date_from = (datetime.now() - timedelta(hours=hours_back)).isoformat()
        
        return await self.fetch_measurements(
            parameter='pm25',
            date_from=date_from,
            limit=10000
        )
    
    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()


# Convenience instance
openaq = OpenAQIngestion()
