"""
OpenStreetMap Overpass Data Fetcher

Fetches static urban features (building density, road density, green cover).
Includes Redis caching to avoid rate limiting.
"""

import logging
import requests
from typing import List, Dict, Any, Optional
import math
import time
from ..services.redis_client import RedisClient

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Alternative Overpass servers for failover
OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter"
]


class OSMFetcher:
    """Fetch urban features from OpenStreetMap via Overpass API with caching."""
    
    def __init__(self):
        self._request_delay = 1.0  # Delay between requests to respect rate limits
        self._last_request_time = 0
        self._current_server_idx = 0
    
    def _get_cache_key(self, center_lat: float, center_lon: float, radius_m: int) -> str:
        """Generate cache key for a location."""
        # Round coordinates to reduce cache fragmentation
        lat_rounded = round(center_lat, 4)
        lon_rounded = round(center_lon, 4)
        return RedisClient.generate_key('osm', lat_rounded, lon_rounded, radius_m)
    
    def _respect_rate_limit(self):
        """Wait if needed to respect Overpass rate limits."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self._request_delay:
            time.sleep(self._request_delay - elapsed)
        self._last_request_time = time.time()
    
    def _try_request(self, query: str) -> Optional[Dict]:
        """Try request with server failover."""
        for attempt in range(len(OVERPASS_SERVERS)):
            server_idx = (self._current_server_idx + attempt) % len(OVERPASS_SERVERS)
            server = OVERPASS_SERVERS[server_idx]
            
            try:
                response = requests.post(
                    server,
                    data={"data": query},
                    timeout=30,
                    headers={'User-Agent': 'PodScout-Pro/1.0'}
                )
                
                if response.status_code == 200:
                    self._current_server_idx = server_idx
                    return response.json()
                elif response.status_code == 429:
                    logger.warning(f"Rate limited on {server}, trying next...")
                    continue
                elif response.status_code == 504:
                    logger.warning(f"Timeout on {server}, trying next...")
                    continue
                else:
                    logger.warning(f"Overpass API error {response.status_code} on {server}")
                    
            except requests.exceptions.Timeout:
                logger.warning(f"Request timeout on {server}")
                continue
            except Exception as e:
                logger.error(f"Request error on {server}: {e}")
                continue
        
        return None
    
    def fetch_urban_features_for_cell(
        self,
        center_lat: float,
        center_lon: float,
        radius_m: int = 500
    ) -> Dict[str, Any]:
        """
        Fetch building, road, and green cover metrics for a cell.
        Uses Redis caching to avoid repeated calls.
        
        Args:
            center_lat, center_lon: Cell center coordinates.
            radius_m: Search radius in meters.
        
        Returns:
            Dict with building_density, road_density, green_cover.
        """
        # Check cache first
        cache_key = self._get_cache_key(center_lat, center_lon, radius_m)
        cached = RedisClient.get(cache_key)
        if cached:
            logger.debug(f"OSM cache hit for {center_lat:.4f},{center_lon:.4f}")
            return cached
        
        try:
            # Respect rate limits
            self._respect_rate_limit()
            
            # Query for buildings, roads, and parks within radius
            query = f"""
            [out:json][timeout:25];
            (
              way["building"](around:{radius_m},{center_lat},{center_lon});
              way["highway"](around:{radius_m},{center_lat},{center_lon});
              way["landuse"="forest"](around:{radius_m},{center_lat},{center_lon});
              way["landuse"="grass"](around:{radius_m},{center_lat},{center_lon});
              way["leisure"="park"](around:{radius_m},{center_lat},{center_lon});
            );
            out count;
            """
            
            data = self._try_request(query)
            
            if data:
                # Parse counts
                elements = data.get("elements", [])
                
                building_count = 0
                road_count = 0
                green_count = 0
                
                for elem in elements:
                    tags = elem.get("tags", {})
                    if "building" in tags:
                        building_count += 1
                    if "highway" in tags:
                        road_count += 1
                    if tags.get("landuse") in ["forest", "grass"] or tags.get("leisure") == "park":
                        green_count += 1
                
                # Normalize to density (0-1 scale, capped)
                # Heuristic: Max 50 buildings = 1.0 density
                result = {
                    "building_density": min(1.0, building_count / 50),
                    "road_density": min(1.0, road_count / 20),
                    "green_cover": min(1.0, green_count / 10),
                    "raw": {
                        "buildings": building_count,
                        "roads": road_count,
                        "green": green_count
                    }
                }
                
                # Cache the result (24 hours TTL for static OSM data)
                RedisClient.set(cache_key, result, prefix='osm')
                
                return result
            else:
                logger.warning(f"All Overpass servers failed for {center_lat:.4f},{center_lon:.4f}")
                return {"building_density": 0.0, "road_density": 0.0, "green_cover": 0.0}
                
        except Exception as e:
            logger.error(f"OSM fetch error: {e}")
            return {"building_density": 0.0, "road_density": 0.0, "green_cover": 0.0}
    
    def fetch_for_cells(self, cells: List[Dict]) -> Dict[str, Dict]:
        """
        Fetch urban features for multiple cells.
        Uses batched requests and caching for efficiency.
        
        Args:
            cells: List of cell dicts with 'id', 'center_lat', 'center_lon'.
        
        Returns:
            Dict mapping cell_id -> feature dict.
        """
        results = {}
        cached_count = 0
        fetched_count = 0
        
        for i, cell in enumerate(cells):
            if i > 0 and i % 10 == 0:
                logger.info(f"  OSM fetch progress: {i}/{len(cells)} (cached: {cached_count}, fetched: {fetched_count})")
            
            features = self.fetch_urban_features_for_cell(
                cell["center_lat"],
                cell["center_lon"],
                radius_m=cell.get("cell_size_meters", 500) // 2
            )
            
            # Track cache vs fresh fetches
            cache_key = self._get_cache_key(
                cell["center_lat"], 
                cell["center_lon"],
                cell.get("cell_size_meters", 500) // 2
            )
            if RedisClient.get(cache_key):
                cached_count += 1
            else:
                fetched_count += 1
            
            results[cell["id"]] = features
        
        logger.info(f"Fetched OSM features for {len(results)} cells (cached: {cached_count}, fetched: {fetched_count})")
        return results
    
    def clear_cache(self) -> int:
        """Clear all OSM cache entries."""
        return RedisClient.invalidate_cache('osm')


# Global instance
osm_fetcher = OSMFetcher()
