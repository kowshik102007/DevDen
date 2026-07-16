"""
Database Setup Script for PodScout Pro

Helps setup Supabase database with required tables and functions.
"""

print("=" * 70)
print("PodScout Pro - Database Setup Guide")
print("=" * 70)

print("""
Your Supabase project: vxoxitherkbtlsbbbxlj
Database URL: https://vxoxitherkbtlsbbbxlj.supabase.co

SETUP STEPS:
============

1. Go to Supabase SQL Editor:
   https://supabase.com/dashboard/project/vxoxitherkbtlsbbbxlj/editor

2. Click "New Query" button

3. Run these SQL files in order:

   A) First: database/schema.sql
      - Creates main tables (monitoring_sites, measurements, etc.)
      - Creates PostGIS functions
      - Adds sample data

   B) Second: database/grid_cells_schema.sql  
      - Creates grid_cells table for spatial processing
      - Creates neighbor finding functions
      - Sets up GNN node relationships

4. Verify tables created:
   - monitoring_sites
   - measurements
   - site_analyses
   - pod_deployments
   - grid_cells

QUICK TEST:
===========

After running the SQL, test in Supabase:

SELECT COUNT(*) FROM monitoring_sites;

You should see 3 sample sites (Delhi, Mumbai, Bangalore).

""")

print("=" * 70)
print("Once database is setup, restart backend to connect!")
print("=" * 70)

# Check if SQL files exist
import os

schema_file = "database/schema.sql"
grid_file = "database/grid_cells_schema.sql"

print("\n  Checking SQL files...")
if os.path.exists(schema_file):
    print(f"✓ {schema_file} exists ({os.path.getsize(schema_file)} bytes)")
else:
    print(f"✗ {schema_file} not found!")

if os.path.exists(grid_file):
    print(f"✓ {grid_file} exists ({os.path.getsize(grid_file)} bytes)")
else:
    print(f"✗ {grid_file} not found!")

print("\nReady to setup database? Follow steps above!")
