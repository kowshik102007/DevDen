
from mcp.server.fastmcp import FastMCP
import os
import requests
import logging
from typing import Dict, Any, Optional

# Create MCP Server
mcp = FastMCP("PodScout Scout Agent")
logger = logging.getLogger(__name__)

@mcp.tool()
def find_location(query: str) -> Dict[str, Any]:
    """
    Find location details (lat, lon, bbox) for a place name.
    """
    print(f"Scout searching for: {query}")
    try:
        url = "https://nominatim.openstreetmap.org/search"
        headers = {
            'User-Agent': f'PodScoutDataIngestion/1.0 ({os.environ.get("CONTACT_EMAIL", "podscout-bot@example.com")})'
        }
        params = {
            'q': query,
            'format': 'json',
            'limit': 1
        }
        
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                place = data[0]
                # BBox format in Nominatim: [min_lat, max_lat, min_lon, max_lon]
                # We want: [min_lon, min_lat, max_lon, max_lat]
                raw_bbox = [float(x) for x in place['boundingbox']]
                bbox = [raw_bbox[2], raw_bbox[0], raw_bbox[3], raw_bbox[1]]
                
                return {
                    "name": place['display_name'],
                    "lat": float(place['lat']),
                    "lon": float(place['lon']),
                    "bbox": bbox,
                    "type": place.get('type', 'unknown'),
                    "status": "found"
                }
            else:
                return {"status": "not_found", "message": f"No location found for '{query}'"}
        else:
            return {"status": "error", "message": f"Nominatim API error: {response.status_code}"}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    mcp.run(transport="stdio")
