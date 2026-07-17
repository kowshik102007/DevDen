"""
Spatial Graph Builder for GNN

Constructs graph structures from grid cells for Graph Neural Network training.
Uses PyTorch Geometric format.
"""

from typing import List, Dict, Optional, Tuple
import asyncio
import numpy as np
import logging

try:
    import torch
    from torch_geometric.data import Data
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("PyTorch Geometric not installed. ML features disabled.")

from ..services.supabase import get_supabase

logger = logging.getLogger(__name__)


class SpatialGraphBuilder:
    """Build PyTorch Geometric graphs from grid cells."""
    
    def __init__(self):
        # Use direct DB connection instead of Supabase API
        self.db_config = None
        self._setup_db_config()
        
        self.feature_names = [
            # Current pollutants (6)
            'avg_pm25', 'avg_pm10', 'avg_no2', 'avg_so2', 'avg_co', 'avg_o3',
            # Environmental (2)
            'avg_temperature', 'avg_humidity',
            # Temporal features (7)
            'pm25_1h', 'pm25_24h', 'pm25_7d', 
            'pm25_trend', 'pm25_volatility',
            'max_pm25', 'min_pm25',
            # Spatial features (3)
            'population_density', 'num_monitoring_sites', 
            'nearest_site_distance',
            # New Static Features (3)
            'building_density', 'road_density', 'green_cover'
        ]
        self.num_features = len(self.feature_names)
        
    def _setup_db_config(self):
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        url = os.environ.get("SUPABASE_URL", "")
        if url:
             host = url.split("//")[1].split(".")[0] + ".supabase.co"
             # Hardcoded fallback from analyze_noida_pods.py
             self.db_config = {
                 "host": host,
                 "database": "postgres",
                 "user": "postgres",
                 "password": os.environ.get("SUPABASE_DB_PASSWORD"),
                 "port": "5432",
                 "sslmode": "require",
                 "connect_timeout": 20
             }

    def _get_connection(self):
        import psycopg2
        if not self.db_config:
            raise RuntimeError("DB config not initialised — check SUPABASE_URL env var")
        return psycopg2.connect(**self.db_config)
    
    async def build_city_graph(self, city: str, wind_dir_deg: float = 270.0) -> Optional['Data']:
        """
        Build graph for a specific city with dynamic wind-weighted edges.
        
        Args:
            city: City name
            wind_dir_deg: Wind direction (0=N, 90=E). Default 270 (Westerly).
        
        Returns:
            PyTorch Geometric Data object or None if unavailable
        """
        if not TORCH_AVAILABLE:
            logger.error("PyTorch Geometric not available")
            return None
            
        try:
            # Psycopg2 is synchronous; run in executor to avoid blocking the event loop
            loop = asyncio.get_event_loop()

            def _fetch_cells():
                conn = self._get_connection()
                try:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT * FROM grid_cells WHERE city = %s ORDER BY gnn_node_id",
                        (city,),
                    )
                    cols = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    return [dict(zip(cols, row)) for row in rows]
                finally:
                    conn.close()

            cells = await loop.run_in_executor(None, _fetch_cells)

        except Exception as e:
            logger.error("DB Error fetching grid cells for %s: %s", city, e)
            return None
        
        if not cells:
            logger.warning(f"No grid cells found for {city}")
            return None
        
        logger.info(f"Building graph for {city} with {len(cells)} nodes (Wind={wind_dir_deg}°)")
        
        # Extract features
        node_features = self._extract_node_features(cells)
        
        # Build edges (Dynamic Wind)
        edge_index, edge_attr = self._build_dynamic_edges(cells, wind_dir_deg)
        
        # Create PyTorch Geometric Data object
        graph = Data(
            x=torch.tensor(node_features, dtype=torch.float32),
            edge_index=torch.tensor(edge_index, dtype=torch.long),
            edge_attr=torch.tensor(edge_attr, dtype=torch.float32)
        )
        
        logger.info(f"  Graph: {graph.num_nodes} nodes, {graph.num_edges} edges")
        
        return graph
    
    def _extract_node_features(self, cells: List[Dict]) -> np.ndarray:
        """
        Extract feature matrix from grid cells.
        
        Returns:
            Array of shape [num_nodes, num_features]
        """
        features = []
        
        for cell in cells:
            node_features = []
            
            for feature_name in self.feature_names:
                value = cell.get(feature_name)
                
                # Handle missing values
                if value is None:
                    if 'pm25' in feature_name or 'pm10' in feature_name:
                        value = 0.0  # Default pollutant level
                    elif 'temperature' in feature_name:
                        value = 25.0  # Default temperature
                    elif 'population_density' in feature_name:
                        value = cell.get('population_density', 1000)
                    else:
                        value = 0.0
                
                try:
                    node_features.append(float(value))
                except (ValueError, TypeError):
                    node_features.append(0.0)
            
            features.append(node_features)
        
        return np.array(features, dtype=np.float32)
    
    def _build_dynamic_edges(self, cells: List[Dict], wind_dir_deg: float) -> Tuple[np.ndarray, np.ndarray]:
        """
        Build edge connectivity with wind-influenced weights.
        
        w_ij = exp( -k * (1 - cos(theta_wind - theta_ij)) ) / distance
        
        Returns:
            edge_index: [2, num_edges] array
            edge_attr: [num_edges, num_edge_features (weight, distance)]
        """
        import math
        edges = []
        edge_features = []
        
        # Create node_id to index mapping
        node_map = {cell['gnn_node_id']: idx for idx, cell in enumerate(cells)}
        
        wind_rad = math.radians(wind_dir_deg)
        
        for idx, cell in enumerate(cells):
            neighbor_ids = cell.get('neighbor_node_ids', [])
            if not neighbor_ids:
                continue
            
            lat1, lon1 = cell['center_lat'], cell['center_lon']
            
            for neighbor_id in neighbor_ids:
                if neighbor_id not in node_map:
                    continue
                
                neighbor_idx = node_map[neighbor_id]
                lat2, lon2 = cells[neighbor_idx]['center_lat'], cells[neighbor_idx]['center_lon']
                
                # 1. Distance
                distance = self._calculate_distance(lat1, lon1, lat2, lon2)
                if distance == 0: distance = 1.0 # Prevent div/0

                # 2. Bearing from i to j
                d_lon = math.radians(lon2 - lon1)
                y = math.sin(d_lon) * math.cos(math.radians(lat2))
                x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) \
                    - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(d_lon)
                bearing_rad = math.atan2(y, x)
                
                # 3. Wind Compatibility
                # Dot product of wind vector and edge vector
                # Higher if wind blows from i to j?
                # Actually, pollution flows DOWNWIND.
                # If wind is FROM West (270 deg), it blows TOWARDS East (90 deg).
                # So we want edges aligned with (WindDir + 180).
                # Actually standard wind direction is "where it comes FROM".
                # Flow direction = WindDir + 180.
                
                flow_dir_rad = wind_rad + math.pi 
                
                angle_diff = flow_dir_rad - bearing_rad
                wind_factor = math.cos(angle_diff) 
                
                # Weight: Base connectivity + Wind helper
                # If aligned (cos=1), high weight. If against (cos=-1), low weight.
                weight = max(0.1, (1.0 + wind_factor)) / (distance / 1000.0) # Scale dist to km
                
                edges.append([idx, neighbor_idx])
                edge_features.append([weight, distance])

        if not edges:
            edges = [[i, i] for i in range(len(cells))]
            edge_features = [[1.0, 0.0] for _ in range(len(cells))]
        
        edge_index = np.array(edges, dtype=np.int64).T
        edge_attr = np.array(edge_features, dtype=np.float32)
        
        return edge_index, edge_attr
    
    def _calculate_distance(self, lat1, lon1, lat2, lon2) -> float:
        """Calculate Haversine distance in meters."""
        import math
        
        R = 6371000  # Earth radius in meters
        
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_phi / 2) ** 2 +
             math.cos(phi1) * math.cos(phi2) *
             math.sin(delta_lambda / 2) ** 2)
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def normalize_features(self, graph: 'Data') -> 'Data':
        """
        Normalize node features to zero mean, unit variance.
        
        Args:
            graph: PyTorch Geometric Data object
        
        Returns:
            Normalized graph
        """
        if not TORCH_AVAILABLE:
            return graph
        
        # Compute mean and std
        mean = graph.x.mean(dim=0, keepdim=True)
        std = graph.x.std(dim=0, keepdim=True)
        
        # Avoid division by zero
        std[std == 0] = 1.0
        
        # Normalize
        graph.x = (graph.x - mean) / std
        
        return graph


# Global instance
graph_builder = SpatialGraphBuilder()
