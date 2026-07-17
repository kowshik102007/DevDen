"""
Ingestion scheduler - Orchestrates real data ingestion and storage.

Coordinates periodic data pulls from:
- Satellite sources (Sentinel-5P, Landsat)
- Ground sensors (CPCB, OpenAQ)

Stores all data in Supabase database.
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta
import asyncio
import logging
from .sentinel5p import sentinel5p
from .landsat_lst import landsat_lst
from .cpcb import cpcb
from .openaq import openaq
from ..services.supabase import get_supabase

logger = logging.getLogger(__name__)

# City bounding boxes for major Indian cities
CITY_BBOXES = {
    'delhi': [77.0, 28.4, 77.4, 28.9],
    'mumbai': [72.7, 18.9, 72.9, 19.3],
    'bangalore': [77.4, 12.8, 77.8, 13.1],
    'chennai': [80.1, 12.9, 80.3, 13.2],
    'kolkata': [88.2, 22.4, 88.5, 22.7],
    'hyderabad': [78.2, 17.2, 78.7, 17.6],  # Greater Hyderabad region
}


class IngestionScheduler:
    """Orchestrate data ingestion from all sources and store in database."""
    
    def __init__(self):
        self.running = False
    
    async def run_daily_ingestion(self) -> Dict[str, Any]:
        """
        Run daily data ingestion pipeline.
        
        Returns:
            Summary of ingested data with counts and status
        """
        logger.info("🚀 Starting daily ingestion pipeline")
        start_time = datetime.now()
        
        results = {
            'satellite': {
                'sentinel5p_no2': {'count': 0, 'status': 'pending'},
                'sentinel5p_so2': {'count': 0, 'status': 'pending'},
                'landsat_lst': {'count': 0, 'status': 'pending'}
            },
            'ground_sensors': {
                'cpcb': {'count': 0, 'status': 'pending'},
                'openaq': {'count': 0, 'status': 'pending'}
            },
            'database_inserts': {
                'monitoring_sites': 0,
                'measurements': 0
            },
            'timestamp': start_time.isoformat(),
            'errors': []
        }
        
        try:
            # 1. Fetch satellite data
            logger.info("📡 Fetching satellite data...")
            satellite_data = await self._fetch_satellite_data()
            results['satellite'] = satellite_data
            
            # 2. Fetch ground sensor data
            logger.info("🌍 Fetching ground sensor data...")
            ground_data = await self._fetch_ground_sensors()
            results['ground_sensors'] = ground_data
            
            # 3. Store in Supabase database
            logger.info("💾 Storing data in Supabase...")
            db_results = await self._store_data(satellite_data, ground_data)
            results['database_inserts'] = db_results
            
        except Exception as e:
            logger.error(f"❌ Error in ingestion pipeline: {e}")
            results['errors'].append(str(e))
        
        duration = (datetime.now() - start_time).total_seconds()
        results['duration_seconds'] = round(duration, 2)
        
        logger.info(f"✅ Daily ingestion completed in {duration}s")
        return results
    
    async def _fetch_satellite_data(self) -> Dict[str, Dict[str, Any]]:
        """Fetch data from satellite sources (Sentinel-5P, Landsat)."""
        results = {
            'sentinel5p_no2': {'count': 0, 'status': 'pending', 'data': []},
            'sentinel5p_so2': {'count': 0, 'status': 'pending', 'data': []},
            'landsat_lst': {'count': 0, 'status': 'pending', 'data': []}
        }
        
        try:
            # Sentinel-5P data (NO2 & SO2)
            logger.info("  Fetching Sentinel-5P NO2/SO2...")
            sentinel_data = sentinel5p.fetch_daily_data(CITY_BBOXES, days_back=7)
            
            results['sentinel5p_no2']['data'] = sentinel_data.get('no2', [])
            results['sentinel5p_no2']['count'] = len(results['sentinel5p_no2']['data'])
            results['sentinel5p_no2']['status'] = 'success'
            
            results['sentinel5p_so2']['data'] = sentinel_data.get('so2', [])
            results['sentinel5p_so2']['count'] = len(results['sentinel5p_so2']['data'])
            results['sentinel5p_so2']['status'] = 'success'
            
            logger.info(f"  ✓ Sentinel-5P: {results['sentinel5p_no2']['count']} NO2, {results['sentinel5p_so2']['count']} SO2")
            
        except Exception as e:
            logger.error(f"  ✗ Error fetching Sentinel-5P: {e}")
            results['sentinel5p_no2']['status'] = 'error'
            results['sentinel5p_so2']['status'] = 'error'
        
        try:
            # Landsat LST data
            logger.info("  Fetching Landsat LST...")
            lst_data = landsat_lst.fetch_daily_data(CITY_BBOXES, days_back=16)
            
            results['landsat_lst']['data'] = lst_data
            results['landsat_lst']['count'] = len(lst_data)
            results['landsat_lst']['status'] = 'success'
            
            logger.info(f"  ✓ Landsat: {results['landsat_lst']['count']} LST measurements")
            
        except Exception as e:
            logger.error(f"  ✗ Error fetching Landsat: {e}")
            results['landsat_lst']['status'] = 'error'
        
        return results
    
    async def _fetch_ground_sensors(self) -> Dict[str, Dict[str, Any]]:
        """Fetch data from ground sensor networks (CPCB, OpenAQ)."""
        results = {
            'cpcb': {'count': 0, 'status': 'pending', 'data': []},
            'openaq': {'count': 0, 'status': 'pending', 'data': []}
        }
        
        try:
            # CPCB data for Indian cities
            logger.info("  Fetching CPCB data...")
            tasks = []
            for city in CITY_BBOXES.keys():
                tasks.append(cpcb.fetch_realtime_data(city=city.capitalize()))
            
            cpcb_results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in cpcb_results:
                if isinstance(result, list):
                    results['cpcb']['data'].extend(result)
            
            results['cpcb']['count'] = len(results['cpcb']['data'])
            results['cpcb']['status'] = 'success'
            
            logger.info(f"  ✓ CPCB: {results['cpcb']['count']} measurements")
            
        except Exception as e:
            logger.error(f"  ✗ Error fetching CPCB: {e}")
            results['cpcb']['status'] = 'error'
        finally:
            await cpcb.close()
        
        try:
            # OpenAQ data
            logger.info("  Fetching OpenAQ data...")
            for city, bbox in CITY_BBOXES.items():
                openaq_data = await openaq.fetch_latest_measurements(
                    country='IN',
                    bbox=bbox,
                    limit=100
                )
                results['openaq']['data'].extend(openaq_data)
            
            results['openaq']['count'] = len(results['openaq']['data'])
            results['openaq']['status'] = 'success'
            
            logger.info(f"  ✓ OpenAQ: {results['openaq']['count']} measurements")
            
        except Exception as e:
            logger.error(f"  ✗ Error fetching OpenAQ: {e}")
            results['openaq']['status'] = 'error'
        finally:
            await openaq.close()
        
        return results
    
    async def _store_data(
        self,
        satellite_data: Dict[str, Dict],
        ground_data: Dict[str, Dict]
    ) -> Dict[str, int]:
        """
        Store ingested data in Supabase database.
        
        Returns:
            Count of records inserted per table
        """
        supabase = get_supabase()
        if not supabase:
            logger.warning("⚠️  Supabase not configured - skipping database storage")
            return {'monitoring_sites': 0, 'measurements': 0}
        
        inserted = {'monitoring_sites': 0, 'measurements': 0}
        
        try:
            # Store ground sensor data in monitoring_sites and measurements
            logger.info("  Storing ground sensor data...")
            inserted_sites, inserted_measurements = await self._store_ground_sensor_data(
                supabase,
                ground_data
            )
            inserted['monitoring_sites'] += inserted_sites
            inserted['measurements'] += inserted_measurements
            
            # Store satellite data in measurements
            logger.info("  Storing satellite data...")
            inserted_sat = await self._store_satellite_data(supabase, satellite_data)
            inserted['measurements'] += inserted_sat
            
            logger.info(f"  ✓ Inserted: {inserted['monitoring_sites']} sites, {inserted['measurements']} measurements")
            
        except Exception as e:
            logger.error(f"  ✗ Error storing data: {e}")
            raise
        
        return inserted
    
    async def _store_ground_sensor_data(
        self,
        supabase,
        ground_data: Dict[str, Dict]
    ) -> tuple[int, int]:
        """Store ground sensor data in monitoring_sites and measurements tables.

        Collects all records into lists and performs a single bulk upsert per
        table, avoiding the N+1 pattern of one round-trip per record.
        """
        all_sites: list[dict] = []
        all_measurements: list[dict] = []

        for source_name, source_data in ground_data.items():
            if source_data['status'] != 'success' or not source_data['data']:
                continue

            for record in source_data['data']:
                try:
                    site_id = record.get('station_id', f"{source_name}-{record.get('city', 'unknown')}")
                    site_data = {
                        'id': site_id,
                        'name': record.get('station_name', 'Unknown Station'),
                        'city': record.get('city', 'Unknown'),
                        'lat': record.get('latitude'),
                        'lon': record.get('longitude'),
                        'pm25': record.get('pm25'),
                        'pm10': record.get('pm10'),
                        'no2': record.get('no2'),
                        'so2': record.get('so2'),
                        'co': record.get('co'),
                        'o3': record.get('o3'),
                        'temperature': record.get('temperature'),
                        'humidity': record.get('humidity'),
                        'source': source_name,
                        'data_provider': source_name.upper(),
                        'active': True,
                        'updated_at': datetime.utcnow().isoformat()
                    }
                    site_data = {k: v for k, v in site_data.items() if v is not None}
                    all_sites.append(site_data)

                    measurement_data = {
                        'site_id': site_id,
                        'pm25': record.get('pm25'),
                        'pm10': record.get('pm10'),
                        'no2': record.get('no2'),
                        'so2': record.get('so2'),
                        'co': record.get('co'),
                        'o3': record.get('o3'),
                        'temperature': record.get('temperature'),
                        'humidity': record.get('humidity'),
                        'source': source_name,
                        'is_estimated': False,
                        'measured_at': record.get('timestamp', datetime.utcnow().isoformat())
                    }
                    measurement_data = {k: v for k, v in measurement_data.items() if v is not None}
                    all_measurements.append(measurement_data)

                except Exception as e:
                    logger.error(f"Error preparing record from {source_name}: {e}")

        sites_inserted = 0
        measurements_inserted = 0

        # Bulk upsert sites — single round-trip
        if all_sites:
            try:
                supabase.table('monitoring_sites').upsert(all_sites).execute()
                sites_inserted = len(all_sites)
            except Exception as e:
                logger.error(f"Error bulk-upserting monitoring_sites: {e}")

        # Bulk insert measurements — single round-trip
        if all_measurements:
            try:
                supabase.table('measurements').insert(all_measurements).execute()
                measurements_inserted = len(all_measurements)
            except Exception as e:
                logger.error(f"Error bulk-inserting measurements: {e}")

        return sites_inserted, measurements_inserted
    
    async def _store_satellite_data(
        self,
        supabase,
        satellite_data: Dict[str, Dict]
    ) -> int:
        """Store satellite data in measurements table using a single bulk insert."""
        all_measurements: list[dict] = []

        for source_name, source_data in satellite_data.items():
            if source_data['status'] != 'success' or not source_data['data']:
                continue

            for record in source_data['data']:
                try:
                    measurement_data = {
                        'site_id': record.get('city', 'satellite-unknown'),
                        'no2': record.get('no2') if 'no2' in source_name else None,
                        'so2': record.get('so2') if 'so2' in source_name else None,
                        'lst': record.get('lst') if 'lst' in source_name else None,
                        'source': 'satellite',
                        'is_estimated': False,
                        'quality_flag': record.get('quality'),
                        'measured_at': record.get('timestamp', datetime.utcnow().isoformat())
                    }
                    measurement_data = {k: v for k, v in measurement_data.items() if v is not None}

                    if len(measurement_data) > 2:  # More than just site_id and source
                        all_measurements.append(measurement_data)

                except Exception as e:
                    logger.error(f"Error preparing satellite record from {source_name}: {e}")

        if not all_measurements:
            return 0

        try:
            supabase.table('measurements').insert(all_measurements).execute()
            return len(all_measurements)
        except Exception as e:
            logger.error(f"Error bulk-inserting satellite measurements: {e}")
            return 0


# Global scheduler instance
scheduler = IngestionScheduler()
