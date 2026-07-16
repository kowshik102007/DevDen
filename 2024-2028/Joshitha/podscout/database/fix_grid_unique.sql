-- Fix for Duplicate GNN Node ID Error
-- Run this in Supabase SQL Editor
-- 1. Drop the incorrect global unique constraint
ALTER TABLE grid_cells DROP CONSTRAINT IF EXISTS grid_cells_gnn_node_id_key;
-- 2. Add correct composite unique constraint (City + NodeID)
ALTER TABLE grid_cells
ADD CONSTRAINT grid_cells_city_node_unique UNIQUE (city, gnn_node_id);
-- 3. Verify
-- You should see "grid_cells_city_node_unique" in indexes now.