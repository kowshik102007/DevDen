"""
OpenWeatherMap Data Fetcher

Fetches current weather data (humidity, wind) for grid cells.
"""

import os
import logging
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Free tier: 1000 calls/day
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"


class WeatherFetcher:
    """Fetch weather data from OpenWeatherMap."""
    
    def __init__(self):
        self.api_key = OPENWEATHER_API_KEY
        if not self.api_key:
            logger.warning("OPENWEATHER_API_KEY not set. Weather data unavailable.")
    
    def fetch_weather_for_point(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """
        Fetch current weather for a single point.
        
        Returns:
            Dict with humidity, wind_speed, wind_deg, temp, or None on error.
        """
        if not self.api_key:
            return None
        
        try:
            params = {
                "lat": lat,
                "lon": lon,
                "appid": self.api_key,
                "units": "metric"
            }
            response = requests.get(BASE_URL, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                main = data.get("main", {})
                wind = data.get("wind", {})
                
                return {
                    "lat": lat,
                    "lon": lon,
                    "humidity": main.get("humidity"),
                    "temp": main.get("temp"),
                    "wind_speed": wind.get("speed"),
                    "wind_deg": wind.get("deg"),
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                logger.error(f"OpenWeather API error: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Weather fetch error: {e}")
            return None
    
    def fetch_weather_for_bbox(self, bbox: List[float], grid_size: int = 5) -> List[Dict[str, Any]]:
        """
        Fetch weather data for a grid of points within a bounding box.
        
        Args:
            bbox: [min_lon, min_lat, max_lon, max_lat]
            grid_size: Number of points per axis (total = grid_size^2)
        
        Returns:
            List of weather data dicts.
        """
        min_lon, min_lat, max_lon, max_lat = bbox
        
        lat_step = (max_lat - min_lat) / grid_size
        lon_step = (max_lon - min_lon) / grid_size
        
        results = []
        
        for i in range(grid_size):
            for j in range(grid_size):
                lat = min_lat + (i + 0.5) * lat_step
                lon = min_lon + (j + 0.5) * lon_step
                
                weather = self.fetch_weather_for_point(lat, lon)
                if weather:
                    results.append(weather)
        
        logger.info(f"Fetched weather for {len(results)} points in bbox.")
        return results


# Global instance
weather_fetcher = WeatherFetcher()
