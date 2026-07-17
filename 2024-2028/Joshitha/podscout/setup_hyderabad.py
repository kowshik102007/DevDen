"""
Hyderabad City Complete Setup Script

This script sets up Hyderabad for the PodScout Pro air quality monitoring system:
1. Generates adaptive grid cells (500m urban to 2km rural)
2. Ingests data from all sources (OpenAQ, CPCB, Sentinel-5P, Landsat)
3. Aggregates features (temporal, static, weather)
4. Trains ML model (Bayesian ST-GNN)
5. Validates predictions

Usage:
    python setup_hyderabad.py --full       # Run complete setup
    python setup_hyderabad.py --grid       # Only generate grid
    python setup_hyderabad.py --ingest     # Only run ingestion
    python setup_hyderabad.py --train      # Only train model
    python setup_hyderabad.py --validate   # Only validate predictions
"""

import sys
import os
import asyncio
import argparse
import logging
from datetime import datetime

# Setup path
sys.path.insert(0, os.getcwd())

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Hyderabad Configuration
HYDERABAD_CONFIG = {
    'name': 'Hyderabad',
    'bbox': [78.2, 17.2, 78.7, 17.6],  # [min_lon, min_lat, max_lon, max_lat]
    'center': [78.45, 17.4],
    'timezone': 'Asia/Kolkata',
    'country': 'IN',
    'state': 'Telangana'
}


async def generate_grid():
    """Generate adaptive grid cells for Hyderabad."""
    logger.info("="*60)
    logger.info("📍 STEP 1: Generating Grid Cells for Hyderabad")
    logger.info("="*60)
    
    try:
        from backend.app.spatial.grid_generator import grid_generator
        
        result = await grid_generator.generate_city_grid(
            city=HYDERABAD_CONFIG['name'],
            bbox=HYDERABAD_CONFIG['bbox']
        )
        
        logger.info(f"✅ Grid Generation Complete: {result}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Grid Generation Failed: {e}")
        return {'status': 'error', 'error': str(e)}


async def ingest_data():
    """Ingest data from all sources for Hyderabad."""
    logger.info("="*60)
    logger.info("📡 STEP 2: Ingesting Data from All Sources")
    logger.info("="*60)
    
    results = {
        'openaq': None,
        'sentinel5p': None,
        'landsat': None,
        'osm': None
    }
    
    # 1. OpenAQ Ground Sensor Data
    try:
        logger.info("  🌍 Fetching OpenAQ data...")
        from backend.app.ingestion.openaq import openaq
        
        openaq_data = await openaq.fetch_latest_measurements(
            bbox=HYDERABAD_CONFIG['bbox'],
            country=HYDERABAD_CONFIG['country'],
            limit=100
        )
        
        results['openaq'] = {
            'count': len(openaq_data),
            'status': 'success',
            'sample': openaq_data[:2] if openaq_data else []
        }
        logger.info(f"  ✓ OpenAQ: {len(openaq_data)} measurements")
        
        await openaq.close()
        
    except Exception as e:
        logger.error(f"  ✗ OpenAQ Error: {e}")
        results['openaq'] = {'status': 'error', 'error': str(e)}
    
    # 2. Sentinel-5P Satellite Data (NO2, SO2, CO, O3)
    try:
        logger.info("  🛰️ Fetching Sentinel-5P data...")
        from backend.app.ingestion.sentinel5p import sentinel5p
        
        sentinel_data = sentinel5p.fetch_daily_data(
            {'hyderabad': HYDERABAD_CONFIG['bbox']},
            days_back=7
        )
        
        results['sentinel5p'] = {
            'no2_count': len(sentinel_data.get('no2', [])),
            'so2_count': len(sentinel_data.get('so2', [])),
            'status': 'success'
        }
        logger.info(f"  ✓ Sentinel-5P: {results['sentinel5p']['no2_count']} NO2, {results['sentinel5p']['so2_count']} SO2")
        
    except Exception as e:
        logger.error(f"  ✗ Sentinel-5P Error: {e}")
        results['sentinel5p'] = {'status': 'error', 'error': str(e)}
    
    # 3. Landsat LST (Land Surface Temperature)
    try:
        logger.info("  🌡️ Fetching Landsat LST data...")
        from backend.app.ingestion.landsat_lst import landsat_lst
        
        lst_data = landsat_lst.fetch_daily_data(
            {'hyderabad': HYDERABAD_CONFIG['bbox']},
            days_back=16  # Landsat revisit period
        )
        
        results['landsat'] = {
            'count': len(lst_data),
            'status': 'success'
        }
        logger.info(f"  ✓ Landsat: {len(lst_data)} LST measurements")
        
    except Exception as e:
        logger.error(f"  ✗ Landsat Error: {e}")
        results['landsat'] = {'status': 'error', 'error': str(e)}
    
    # 4. OSM Static Features (Building, Road, Green Cover)
    try:
        logger.info("  🏙️ Fetching OSM features...")
        from backend.app.ingestion.osm import osm_fetcher
        from backend.app.services.supabase import get_supabase
        
        supabase = get_supabase()
        if supabase:
            cells_res = supabase.table("grid_cells").select("id, center_lat, center_lon, cell_size_meters").eq("city", "Hyderabad").limit(10).execute()
            
            if cells_res.data:
                osm_data = osm_fetcher.fetch_for_cells(cells_res.data)
                results['osm'] = {
                    'cells_processed': len(osm_data),
                    'status': 'success'
                }
                logger.info(f"  ✓ OSM: Processed {len(osm_data)} cells with building/road/green cover")
            else:
                results['osm'] = {'status': 'skipped', 'message': 'No grid cells found. Run grid generation first.'}
        else:
            results['osm'] = {'status': 'skipped', 'message': 'Supabase not connected'}
        
    except Exception as e:
        logger.error(f"  ✗ OSM Error: {e}")
        results['osm'] = {'status': 'error', 'error': str(e)}
    
    logger.info(f"✅ Ingestion Complete: {results}")
    return results


async def aggregate_features():
    """Run feature aggregation for Hyderabad grid cells."""
    logger.info("="*60)
    logger.info("🔧 STEP 3: Aggregating Features")
    logger.info("="*60)
    
    results = {}
    
    try:
        from backend.app.agents.feature_agg import aggregate_temporal_features, aggregate_static_features, aggregate_weather_data
        
        # Temporal features
        logger.info("  📊 Aggregating temporal features...")
        temporal_result = await aggregate_temporal_features("Hyderabad")
        results['temporal'] = temporal_result
        logger.info(f"  ✓ Temporal: {temporal_result.get('cells_updated', 0)} cells updated")
        
        # Static features (OSM)
        logger.info("  🏗️ Aggregating static features...")
        static_result = await aggregate_static_features("Hyderabad")
        results['static'] = static_result
        logger.info(f"  ✓ Static: {static_result.get('cells_updated', 0)} cells updated")
        
        # Weather data
        logger.info("  🌤️ Aggregating weather data...")
        weather_result = await aggregate_weather_data("Hyderabad", HYDERABAD_CONFIG['bbox'])
        results['weather'] = weather_result
        logger.info(f"  ✓ Weather: {weather_result.get('status', 'unknown')}")
        
    except Exception as e:
        logger.error(f"❌ Feature Aggregation Failed: {e}")
        results['error'] = str(e)
    
    logger.info(f"✅ Feature Aggregation Complete: {results}")
    return results


async def train_model():
    """Train Bayesian ST-GNN model for Hyderabad."""
    logger.info("="*60)
    logger.info("🧠 STEP 4: Training ML Model for Hyderabad")
    logger.info("="*60)
    
    try:
        from backend.app.ml.train_model import train_city
        
        result = await train_city("Hyderabad")
        
        if result:
            logger.info("✅ Model Training Complete!")
            logger.info(f"  📁 Weights saved to: backend/app/ml/models/hyderabad_weights.pt")
            logger.info(f"  📁 Scaler saved to: backend/app/ml/models/hyderabad_scaler.pt")
            return {'status': 'success'}
        else:
            logger.error("❌ Model Training Failed - No graph data available")
            return {'status': 'error', 'message': 'No graph data. Run ingestion first.'}
            
    except Exception as e:
        logger.error(f"❌ Model Training Error: {e}")
        return {'status': 'error', 'error': str(e)}


async def validate_predictions():
    """Validate that predictions work for Hyderabad."""
    logger.info("="*60)
    logger.info("✅ STEP 5: Validating Predictions")
    logger.info("="*60)
    
    try:
        from backend.app.agents.prediction import predict_pollution, detect_hotspots
        
        # Test pollution prediction
        logger.info("  🔮 Testing pollution prediction...")
        pred_result = await predict_pollution("Hyderabad", 24)
        
        if 'error' not in pred_result:
            logger.info(f"  ✓ Prediction successful: {pred_result.get('summary', {}).get('avg_predicted_pm25', 'N/A')} avg PM2.5")
        else:
            logger.warning(f"  ⚠️ Prediction returned error: {pred_result.get('error')}")
        
        # Test hotspot detection
        logger.info("  🔥 Testing hotspot detection...")
        hotspot_result = await detect_hotspots("Hyderabad", threshold_pm25=100.0)
        
        if 'error' not in hotspot_result:
            logger.info(f"  ✓ Hotspot detection successful: {hotspot_result.get('hotspot_count', 0)} hotspots found")
        else:
            logger.warning(f"  ⚠️ Hotspot detection returned error: {hotspot_result.get('error')}")
        
        # Test recommendations
        logger.info("  💡 Testing recommendations...")
        from backend.app.agents.recommendation import get_recommendations
        rec_result = await get_recommendations("Hyderabad")
        
        if 'error' not in rec_result:
            logger.info(f"  ✓ Recommendations generated: {rec_result.get('action_level', 'N/A')} action level")
        else:
            logger.warning(f"  ⚠️ Recommendations returned error: {rec_result.get('error')}")
        
        logger.info("✅ Validation Complete!")
        return {
            'prediction': pred_result,
            'hotspots': hotspot_result,
            'recommendations': rec_result
        }
        
    except Exception as e:
        logger.error(f"❌ Validation Error: {e}")
        return {'status': 'error', 'error': str(e)}


async def run_full_setup():
    """Run the complete Hyderabad setup pipeline."""
    start_time = datetime.now()
    
    logger.info("="*60)
    logger.info("🚀 HYDERABAD COMPLETE SETUP")
    logger.info(f"   Started: {start_time.isoformat()}")
    logger.info("="*60)
    
    results = {
        'grid': None,
        'ingestion': None,
        'features': None,
        'training': None,
        'validation': None
    }
    
    # Step 1: Generate Grid
    results['grid'] = await generate_grid()
    
    # Step 2: Ingest Data
    results['ingestion'] = await ingest_data()
    
    # Step 3: Aggregate Features
    results['features'] = await aggregate_features()
    
    # Step 4: Train Model
    results['training'] = await train_model()
    
    # Step 5: Validate
    results['validation'] = await validate_predictions()
    
    duration = (datetime.now() - start_time).total_seconds()
    
    logger.info("="*60)
    logger.info("🎉 HYDERABAD SETUP COMPLETE!")
    logger.info(f"   Duration: {duration:.2f} seconds")
    logger.info("="*60)
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Hyderabad City Setup for PodScout Pro")
    parser.add_argument('--full', action='store_true', help='Run complete setup')
    parser.add_argument('--grid', action='store_true', help='Only generate grid')
    parser.add_argument('--ingest', action='store_true', help='Only run ingestion')
    parser.add_argument('--features', action='store_true', help='Only aggregate features')
    parser.add_argument('--train', action='store_true', help='Only train model')
    parser.add_argument('--validate', action='store_true', help='Only validate predictions')
    
    args = parser.parse_args()
    
    # Windows event loop fix
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    if args.grid:
        asyncio.run(generate_grid())
    elif args.ingest:
        asyncio.run(ingest_data())
    elif args.features:
        asyncio.run(aggregate_features())
    elif args.train:
        asyncio.run(train_model())
    elif args.validate:
        asyncio.run(validate_predictions())
    else:
        # Default: run full setup
        asyncio.run(run_full_setup())


if __name__ == "__main__":
    main()
