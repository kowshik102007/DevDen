-- Enhanced Grid Cells Schema for ST-GNN
-- Add to existing schema.sql
-- Drop existing grid_cells if recreating
DROP TABLE IF EXISTS grid_cells CASCADE;
CREATE TABLE IF NOT EXISTS grid_cells (
    id TEXT PRIMARY KEY,
    -- Format: 'grid_lat_lon_level'
    -- Geometry (PostGIS)
    cell_geom GEOGRAPHY(POLYGON, 4326),
    center_lat DOUBLE PRECISION NOT NULL,
    center_lon DOUBLE PRECISION NOT NULL,
    cell_size_meters INTEGER NOT NULL,
    -- Grid metadata
    grid_level INTEGER NOT NULL,
    -- 1=urban(500m), 2=suburban(1km), 3=rural(2km)
    city TEXT NOT NULL,
    -- Aggregated real-time features
    avg_pm25 DOUBLE PRECISION,
    avg_pm10 DOUBLE PRECISION,
    avg_no2 DOUBLE PRECISION,
    avg_so2 DOUBLE PRECISION,
    avg_co DOUBLE PRECISION,
    avg_o3 DOUBLE PRECISION,
    avg_temperature DOUBLE PRECISION,
    avg_humidity DOUBLE PRECISION,
    max_pm25 DOUBLE PRECISION,
    min_pm25 DOUBLE PRECISION,
    -- Temporal rolling features
    pm25_1h DOUBLE PRECISION,
    -- 1-hour rolling average
    pm25_24h DOUBLE PRECISION,
    -- 24-hour rolling average
    pm25_7d DOUBLE PRECISION,
    -- 7-day rolling average
    pm25_trend DOUBLE PRECISION,
    -- Trend coefficient
    pm25_volatility DOUBLE PRECISION,
    -- Standard deviation
    -- Spatial context features
    num_monitoring_sites INTEGER DEFAULT 0,
    nearest_site_distance DOUBLE PRECISION,
    population_density INTEGER,
    land_use_type TEXT,
    -- residential/commercial/industrial/mixed
    -- Graph features for GNN
    gnn_node_id INTEGER UNIQUE,
    -- Node index in graph (0-indexed)
    neighbor_cell_ids TEXT [],
    -- Array of adjacent cell IDs
    neighbor_node_ids INTEGER [],
    -- Array of neighbor GNN node IDs
    features_vector DOUBLE PRECISION [],
    -- Pre-computed feature vector for ML
    -- Timestamps
    last_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Spatial index for geographic queries
CREATE INDEX IF NOT EXISTS grid_cells_geom_idx ON grid_cells USING GIST (cell_geom);
-- Regular indexes
CREATE INDEX IF NOT EXISTS grid_cells_city_idx ON grid_cells(city);
CREATE INDEX IF NOT EXISTS grid_cells_level_idx ON grid_cells(grid_level);
CREATE INDEX IF NOT EXISTS grid_cells_node_idx ON grid_cells(gnn_node_id);
CREATE INDEX IF NOT EXISTS grid_cells_pm25_idx ON grid_cells(avg_pm25 DESC NULLS LAST);
-- Auto-update last_update timestamp
CREATE TRIGGER update_grid_cells_last_update BEFORE
UPDATE ON grid_cells FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Function to find neighbor cells (within distance threshold)
CREATE OR REPLACE FUNCTION find_neighbor_cells(
        cell_id_param TEXT,
        distance_threshold_meters DOUBLE PRECISION DEFAULT 2500
    ) RETURNS TABLE(
        neighbor_id TEXT,
        distance_meters DOUBLE PRECISION
    ) AS $$ BEGIN RETURN QUERY
SELECT gc.id,
    ST_Distance(
        (
            SELECT cell_geom
            FROM grid_cells
            WHERE id = cell_id_param
        ),
        gc.cell_geom
    ) as distance
FROM grid_cells gc
WHERE gc.id != cell_id_param
    AND ST_DWithin(
        (
            SELECT cell_geom
            FROM grid_cells
            WHERE id = cell_id_param
        ),
        gc.cell_geom,
        distance_threshold_meters
    )
ORDER BY distance
LIMIT 8;
-- K-nearest neighbors (K=8 for grid)
END;
$$ LANGUAGE plpgsql;
-- Function to aggregate site measurements for a cell
CREATE OR REPLACE FUNCTION aggregate_cell_measurements(cell_id_param TEXT) RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
SELECT json_build_object(
        'avg_pm25',
        AVG(ms.pm25),
        'avg_pm10',
        AVG(ms.pm10),
        'avg_no2',
        AVG(ms.no2),
        'avg_so2',
        AVG(ms.so2),
        'max_pm25',
        MAX(ms.pm25),
        'min_pm25',
        MIN(ms.pm25),
        'num_sites',
        COUNT(*)
    ) INTO result
FROM monitoring_sites ms
WHERE ST_Within(
        ms.location,
        (
            SELECT cell_geom
            FROM grid_cells
            WHERE id = cell_id_param
        )
    )
    AND ms.active = true;
RETURN result;
END;
$$ LANGUAGE plpgsql;