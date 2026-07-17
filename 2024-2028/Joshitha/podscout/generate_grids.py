
import os
import psycopg2
import math
from dotenv import load_dotenv
import sys

load_dotenv()

# DB Connection (Reusing logic from apply_schema)
DB_HOST = os.environ.get("SUPABASE_URL", "").split("//")[1].split(".")[0] + ".supabase.co"
PROJECT_REF = os.environ.get("SUPABASE_URL", "").split("//")[1].split(".")[0]
DB_HOST = f"db.{PROJECT_REF}.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASS = os.environ.get("SUPABASE_DB_PASSWORD")
DB_PORT = "5432"

def get_db_connection():
    import socket
    import time
    
    last_error = None
    for attempt in range(5):
        try:
            addr_info = socket.getaddrinfo(DB_HOST, DB_PORT, proto=socket.IPPROTO_TCP)
            print(f"Resolved to: {addr_info[0][4][0]} (Attempt {attempt+1})")
            return psycopg2.connect(
                host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS, port=DB_PORT,
                connect_timeout=20, sslmode='require'
            )
        except Exception as e:
            print(f"Connection attempt {attempt+1} failed: {e}")
            if attempt > 1:
                # Fallback to hardcoded IP
                HARDCODED_IP = "2406:da1c:f42:ae02:fb21:1d32:9ee3:7759"
                print("Trying hardcoded IPv6...")
                return psycopg2.connect(
                    host=HARDCODED_IP, database=DB_NAME, user=DB_USER, password=DB_PASS, port=DB_PORT,
                    connect_timeout=20, sslmode='require'
                )
            last_error = e

def generate_grid(city_name, min_lat, min_lon, max_lat, max_lon, step_km=2.0):
    print(f"Generating grid for {city_name}...")
    
    # Approx degrees per km
    lat_step = step_km / 111.0
    lon_step = step_km / (111.0 * math.cos(math.radians((min_lat + max_lat)/2)))
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Apply Schema First to ensure table exists with correct structure
    try:
        print("Applying Grid Schema...")
        with open("database/grid_cells_schema.sql", "r") as f:
            schema_sql = f.read()
        cur.execute(schema_sql)
        conn.commit()
        print("✅ Grid Schema applied successfully.")
    except Exception as e:
        print(f"⚠️ Schema application failed (might already exist or syntax error): {e}")
        conn.rollback() # Important to rollback to continue
    
    count = 0
    lat = min_lat
    while lat < max_lat:
        lon = min_lon
        while lon < max_lon:
            # Create cell ID
            cell_id = f"{city_name.lower().replace(' ', '')}_{lat:.3f}_{lon:.3f}"
            
            # Create Polygon WKT
            # specific logic for a box
            p1 = f"{lon} {lat}"
            p2 = f"{lon + lon_step} {lat}"
            p3 = f"{lon + lon_step} {lat + lat_step}"
            p4 = f"{lon} {lat + lat_step}"
            wkt = f"POLYGON(({p1}, {p2}, {p3}, {p4}, {p1}))"
            
            center_lat = lat + lat_step/2
            center_lon = lon + lon_step/2
            
            sql = """
            INSERT INTO grid_cells (
                id, city, center_lat, center_lon, cell_size_meters, grid_level, cell_geom
            ) VALUES (
                %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326)
            ) ON CONFLICT (id) DO UPDATE SET
                center_lat = EXCLUDED.center_lat,
                last_update = NOW();
            """
            
            if "--dry-run" in sys.argv:
               print(cur.mogrify(sql, (cell_id, city_name, center_lat, center_lon, int(step_km*1000), 2, wkt)).decode('utf-8'))
               count += 1
               continue

            try:
                cur.execute(sql, (
                    cell_id, city_name, center_lat, center_lon, int(step_km*1000), 2, wkt
                ))
                count += 1
            except Exception as e:
                print(f"Failed to insert {cell_id}: {e}")
                
            lon += lon_step
        lat += lat_step
        
    conn.commit()
    cur.close()
    conn.close()
    print(f"✅ Generated {count} grid cells for {city_name}.")

if __name__ == "__main__":
    # Default to Greater Noida if no args
    c_name = "Greater Noida"
    # Approx BBox for Greater Noida
    # 28.43, 77.45 to 28.58, 77.60
    generate_grid(c_name, 28.42, 77.40, 28.60, 77.62, step_km=3.0) 
    # Using 3km step to reduce number of calls for demo speed
