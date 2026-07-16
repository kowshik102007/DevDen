
import logging
import sys
import os

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath("backend"))

from app.ingestion.sentinel5p import sentinel5p
from app.ingestion.landsat_lst import landsat_lst
from datetime import datetime, timedelta

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def verify_gee_fetch():
    print("🚀 Starting Manual GEE Verification (Extended)...")
    
    # Gajuwaka BBox (Approx)
    # min_lon, min_lat, max_lon, max_lat
    bbox = [83.1930062, 17.6613983, 83.2330062, 17.7013983]
    
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    print(f"📅 Date Range: {start_date} to {end_date}")
    print(f"📍 BBox: {bbox}")
    
    # 1. Test Sentinel-5P NO2
    print("\n🛰️ Testing Sentinel-5P NO2...")
    try:
        no2_data = sentinel5p.fetch_no2(bbox, start_date, end_date)
        print(f"✅ Fetched {len(no2_data)} NO2 records.")
        if no2_data:
            print(f"   Sample: {no2_data[0]}")
    except Exception as e:
        print(f"❌ NO2 Fetch Error: {e}")

    # 2. Test Sentinel-5P SO2
    print("\n🛰️ Testing Sentinel-5P SO2...")
    try:
        so2_data = sentinel5p.fetch_so2(bbox, start_date, end_date)
        print(f"✅ Fetched {len(so2_data)} SO2 records.")
        if so2_data:
            print(f"   Sample: {so2_data[0]}")
    except Exception as e:
        print(f"❌ SO2 Fetch Error: {e}")

    # 3. Test Sentinel-5P CO
    print("\n🛰️ Testing Sentinel-5P CO...")
    try:
        co_data = sentinel5p.fetch_co(bbox, start_date, end_date)
        print(f"✅ Fetched {len(co_data)} CO records.")
        if co_data:
            print(f"   Sample: {co_data[0]}")
    except Exception as e:
        print(f"❌ CO Fetch Error: {e}")

    # 4. Test Sentinel-5P O3
    print("\n🛰️ Testing Sentinel-5P O3...")
    try:
        o3_data = sentinel5p.fetch_o3(bbox, start_date, end_date)
        print(f"✅ Fetched {len(o3_data)} O3 records.")
        if o3_data:
            print(f"   Sample: {o3_data[0]}")
    except Exception as e:
        print(f"❌ O3 Fetch Error: {e}")

    # 5. Test Landsat LST
    print("\n🛰️ Testing Landsat LST...")
    try:
        lst_data = landsat_lst.fetch_lst(bbox, start_date, end_date)
        print(f"✅ Fetched {len(lst_data)} LST records.")
        if lst_data:
            print(f"   Sample: {lst_data[0]}")
    except Exception as e:
        print(f"❌ LST Fetch Error: {e}")

if __name__ == "__main__":
    verify_gee_fetch()
