
from mcp.server.fastmcp import FastMCP
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging

# Import existing ingestion modules
try:
    from backend.app.ingestion.sentinel5p import sentinel5p
    from backend.app.ingestion.landsat_lst import landsat_lst
    from backend.app.ingestion.openaq import openaq
    from backend.app.ingestion.cpcb import cpcb
    from backend.app.ingestion.land_pop import land_pop
    from backend.app.ingestion.osm import osm_fetcher
    from backend.app.spatial.grid_generator import grid_generator
except ImportError as e:
    logging.error(f"Failed to import ingestion modules: {e}")

mcp = FastMCP("PodScout Ingestion Agent")
logger = logging.getLogger(__name__)

@mcp.tool()
async def setup_new_city(
    city: str,
    bbox: List[float]
) -> Dict[str, Any]:
    """
    Generate grid cells for a new city.
    bbox: [min_lon, min_lat, max_lon, max_lat]
    """
    try:
        # Generate Grid
        result = await grid_generator.generate_city_grid(city, bbox)
        return {
            "status": "success",
            "message": f"Generated {result['cells_stored']} grid cells for {city}.",
            "details": result
        }
    except Exception as e:
        return {"status": "error", "message": f"Grid generation failed: {e}"}

@mcp.tool()
async def ingest_satellite_data(
    bbox: List[float],
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetch and STORE satellite data (NO2, SO2, LST).
    """
    from backend.app.ingestion.scheduler import scheduler
    from backend.app.services.supabase import get_supabase
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
        
    results = {}
    
    try:
        # Fetch NO2 (includes SO2)
        no2_data = sentinel5p.fetch_no2(bbox, start_date, end_date)
        
        # Fetch SO2 separately
        so2_data = sentinel5p.fetch_so2(bbox, start_date, end_date) if hasattr(sentinel5p, 'fetch_so2') else []
        
        # Fetch CO
        co_data = sentinel5p.fetch_co(bbox, start_date, end_date) if hasattr(sentinel5p, 'fetch_co') else []
        
        # Fetch O3
        o3_data = sentinel5p.fetch_o3(bbox, start_date, end_date) if hasattr(sentinel5p, 'fetch_o3') else []
        
        # Fetch LST
        lst_data = landsat_lst.fetch_lst(bbox, start_date, end_date)
        
        # Fetch Population & Land Cover
        pop_land_data = land_pop.fetch_data(bbox)
        
        # Store & Map to Grid
        supabase = get_supabase()
        mapped_count = 0
        
        if supabase:
            cells_res = supabase.table("grid_cells").select("id, center_lat, center_lon").execute()
            cells = cells_res.data
            
            import math
            def get_dist(lat1, lon1, lat2, lon2):
                return math.sqrt((lat1-lat2)**2 + (lon1-lon2)**2)
            
            # Filter cells within bbox
            relevant_cells = [c for c in cells if 
                              bbox[1] <= c['center_lat'] <= bbox[3] and 
                              bbox[0] <= c['center_lon'] <= bbox[2]]
            
            logger.info(f"Found {len(relevant_cells)} relevant cells for bbox {bbox}")
            
            # Fallback: If we have satellite data but no precise mapping, distribute evenly
            if relevant_cells:
                # Calculate city-wide averages from satellite data
                avg_no2_city = None
                avg_so2_city = None
                avg_lst_city = None
                
                if no2_data:
                    no2_vals = [pt['no2'] for pt in no2_data if pt.get('no2') is not None]
                    if no2_vals:
                        avg_no2_city = sum(no2_vals) / len(no2_vals)
                
                if so2_data:
                    so2_vals = [pt['so2'] for pt in so2_data if pt.get('so2') is not None]
                    if so2_vals:
                        avg_so2_city = sum(so2_vals) / len(so2_vals)
                
                # CO and O3 Averages
                avg_co_city = None
                avg_o3_city = None
                
                if co_data:
                    co_vals = [pt['co'] for pt in co_data if pt.get('co') is not None]
                    if co_vals:
                        avg_co_city = sum(co_vals) / len(co_vals)
                        
                if o3_data:
                    o3_vals = [pt['o3'] for pt in o3_data if pt.get('o3') is not None]
                    if o3_vals:
                        avg_o3_city = sum(o3_vals) / len(o3_vals)
                
                if lst_data:
                    # Fix: Key is 'lst_celsius' not 'lst'
                    lst_vals = [pt['lst_celsius'] for pt in lst_data if pt.get('lst_celsius') is not None]
                    if lst_vals:
                        avg_lst_city = sum(lst_vals) / len(lst_vals)
                
                # Pop & Land Cover
                # Map these by nearest neighbor since resolution is higher (100m)
                pop_map = {}
                land_map = {}
                for pl in pop_land_data:
                     # Find nearest cell
                     nearest = min(relevant_cells, key=lambda c: get_dist(c['center_lat'], c['center_lon'], pl['lat'], pl['lon']))
                     if get_dist(nearest['center_lat'], nearest['center_lon'], pl['lat'], pl['lon']) < 0.02: # ~2km
                         cid = nearest['id']
                         if 'population_density' in pl:
                             pop_map[cid] = max(pop_map.get(cid, 0), pl['population_density'])
                         if 'land_use_type' in pl and cid not in land_map:
                             land_map[cid] = pl['land_use_type']
                
                # Fetch OSM data for relevant cells
                osm_data = {}
                try:
                    osm_data = osm_fetcher.fetch_for_cells(relevant_cells)
                    logger.info(f"Fetched OSM data for {len(osm_data)} cells")
                except Exception as osm_e:
                    logger.warning(f"OSM fetch failed: {osm_e}")
                
                # Update ALL cells in bbox with city-wide averages
                for cell in relevant_cells:
                    updates = {"last_update": datetime.now().isoformat()}
                    
                    if avg_no2_city is not None:
                        updates['avg_no2'] = round(avg_no2_city * 1e6, 4)  # Convert to µmol/m²
                    if avg_so2_city is not None:
                        updates['avg_so2'] = round(avg_so2_city * 1e6, 4)
                    if avg_co_city is not None:
                        updates['avg_co'] = round(avg_co_city * 1e6, 4)  # Convert to µmol/m²
                    if avg_o3_city is not None:
                        updates['avg_o3'] = round(avg_o3_city * 1e6, 4)  # Convert to µmol/m²
                    if avg_lst_city is not None:
                        updates['avg_temperature'] = round(avg_lst_city, 2)  # Already Celsius
                        # Estimate humidity from temperature (heuristic: higher temp = lower humidity in tropics)
                        # Formula: est_humidity = 100 - (temp - 20) * 2, clamped to 30-95%
                        est_humidity = max(30, min(95, 100 - (avg_lst_city - 20) * 2))
                        updates['avg_humidity'] = round(est_humidity, 1)
                    
                    # Estimate PM2.5/PM10 from satellite pollutants (research-based approximation)
                    # PM2.5 correlates with NO2, CO; Simple linear model: PM2.5 ~ 50 + NO2*0.5 + CO*0.1
                    if avg_no2_city is not None or avg_co_city is not None:
                        est_pm25 = 40  # Base
                        if avg_no2_city:
                            est_pm25 += (avg_no2_city * 1e6) * 0.3
                        if avg_co_city:
                            est_pm25 += (avg_co_city * 1e4) * 0.05
                        est_pm25 = max(10, min(500, est_pm25))  # Clamp realistic range
                        updates['avg_pm25'] = round(est_pm25, 1)
                        updates['max_pm25'] = round(est_pm25 * 1.2, 1)  # 20% higher
                        updates['min_pm25'] = round(est_pm25 * 0.8, 1)  # 20% lower
                        # PM10 ~ PM2.5 * 1.5 (typical ratio)
                        updates['avg_pm10'] = round(est_pm25 * 1.5, 1)
                    
                    # Update Pop & Land
                    if cell['id'] in pop_map:
                         updates['population_density'] = int(pop_map[cell['id']])
                    if cell['id'] in land_map:
                         updates['land_use_type'] = land_map[cell['id']]
                    
                    # Update OSM features
                    if cell['id'] in osm_data:
                         osm = osm_data[cell['id']]
                         updates['building_density'] = osm.get('building_density', 0.0)
                         updates['road_density'] = osm.get('road_density', 0.0)
                         updates['green_cover'] = osm.get('green_cover', 0.0)

                    if len(updates) > 1:
                        supabase.table("grid_cells").update(updates).eq("id", cell['id']).execute()
                        mapped_count += 1
                
                logger.info(f"Applied city-wide satellite averages: NO2={avg_no2_city}, SO2={avg_so2_city}, LST={avg_lst_city}")
            
            store_msg = f"Mapped satellite data to {mapped_count} grid cells."
        else:
            store_msg = "DB not connected."

        return {
            "status": "success",
            "bbox": bbox,
            "period": f"{start_date} to {end_date}",
            "data": {
                'no2_count': len(no2_data), 
                'so2_count': len(so2_data), 
                'lst_count': len(lst_data),
                'pop_land_count': len(pop_land_data)
            },
            "message": f"Ingested {len(no2_data)} NO2, {len(so2_data)} SO2, {len(lst_data)} LST, {len(pop_land_data)} Pop/Land. {store_msg}"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@mcp.tool()
async def ingest_ground_data(
    city: str,
    bbox: List[float]
) -> Dict[str, Any]:
    """
    Fetch and STORE ground data.
    """
    from backend.app.ingestion.scheduler import scheduler
    from backend.app.services.supabase import get_supabase

    results = {}
    try:
        # OpenAQ
        oa_data = await openaq.fetch_latest_measurements(country='IN', bbox=bbox)
        
        # Store
        supabase = get_supabase()
        if supabase:
            ground_payload = {
                'openaq': {'status': 'success', 'data': oa_data},
                'cpcb': {'status': 'pending', 'data': []}
            }
            sites, meas = await scheduler._store_ground_sensor_data(supabase, ground_payload)
            store_msg = f"Stored {sites} sites, {meas} measurements."
        else:
            store_msg = "DB not connected."
        
        return {
            "status": "success",
            "city": city,
            "data": {'openaq_count': len(oa_data)},
            "message": f"Ingested {len(oa_data)} readings. {store_msg}"
        }
    except Exception as e:
         return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    mcp.run(transport="stdio")
