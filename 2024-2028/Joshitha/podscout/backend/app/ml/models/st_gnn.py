"""
Spatio-Temporal Graph Neural Network (ST-GNN)

Multi-task model for:
1. PM2.5 prediction (regression)
2. Hotspot classification (binary classification)

Architecture:
- Spatial: Graph Convolutional Network (GCN)
- Temporal: LSTM for time-series modeling
- Multi-task: Separate heads for regression and classification
"""

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch_geometric.nn import GCNConv, GATConv, global_mean_pool
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


if TORCH_AVAILABLE:
    class SpatioTemporalGNN(nn.Module):
        """
        ST-GNN for pollution prediction and hotspot detection.
        
        Args:
            num_node_features: Number of input features per node (default: 14)
            hidden_dim: Hidden dimension size (default: 64)
            num_gnn_layers: Number of GNN layers (default: 3)
            num_lstm_layers: Number of LSTM layers (default: 2)
            dropout: Dropout rate (default: 0.2)
            use_gat: Use GAT instead of GCN (default: False)
        """
        
        def __init__(
            self,
            num_node_features: int = 14,
            hidden_dim: int = 64,
            num_gnn_layers: int = 3,
            num_lstm_layers: int = 2,
            dropout: float = 0.2,
            use_gat: bool = False
        ):
            super().__init__()
            
            self.num_node_features = num_node_features
            self.hidden_dim = hidden_dim
            self.dropout = dropout
            
            # Spatial GNN layers
            self.gnn_layers = nn.ModuleList()
            
            if use_gat:
                # Graph Attention Network
                self.gnn_layers.append(
                    GATConv(num_node_features, hidden_dim, heads=4, concat=False)
                )
                for _ in range(num_gnn_layers - 1):
                    self.gnn_layers.append(
                        GATConv(hidden_dim, hidden_dim, heads=4, concat=False)
                    )
            else:
                # Graph Convolutional Network
                self.gnn_layers.append(GCNConv(num_node_features, hidden_dim))
                for _ in range(num_gnn_layers - 1):
                    self.gnn_layers.append(GCNConv(hidden_dim, hidden_dim))
            
            # Batch normalization
            self.batch_norms = nn.ModuleList([
                nn.BatchNorm1d(hidden_dim) for _ in range(num_gnn_layers)
            ])
            
            # Temporal LSTM (for time-series)
            self.lstm = nn.LSTM(
                input_size=hidden_dim,
                hidden_size=hidden_dim,
                num_layers=num_lstm_layers,
                dropout=dropout if num_lstm_layers > 1 else 0,
                batch_first=True
            )
            
            # Regression head (PM2.5 prediction)
            self.regression_head = nn.Sequential(
                nn.Linear(hidden_dim, 32),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(32, 1)
            )
            
            # Classification head (hotspot detection)
            self.classification_head = nn.Sequential(
                nn.Linear(hidden_dim, 32),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(32, 2)  # Binary: hotspot or not
            )
        
        def forward_spatial(self, x, edge_index):
            """
            Forward pass through GNN layers (spatial).
            
            Args:
                x: Node features [num_nodes, num_features]
                edge_index: Edge connectivity [2, num_edges]
            
            Returns:
                Node embeddings [num_nodes, hidden_dim]
            """
            for i, (gnn_layer, bn) in enumerate(zip(self.gnn_layers, self.batch_norms)):
                x = gnn_layer(x, edge_index)
                x = bn(x)
                x = F.relu(x)
                x = F.dropout(x, p=self.dropout, training=self.training)
            
            return x
        
        def forward(self, data, use_temporal=False):
            """
            Forward pass.
            
            Args:
                data: PyTorch Geometric Data object or list of Data objects
                use_temporal: Whether to use LSTM for temporal modeling
            
            Returns:
                pm25_pred: Predicted PM2.5 [num_nodes, 1]
                hotspot_logits: Hotspot classification logits [num_nodes, 2]
            """
            if use_temporal and isinstance(data, list):
                # Temporal sequence of graphs
                spatial_embeddings = []
                
                for graph in data:
                    x = self.forward_spatial(graph.x, graph.edge_index)
                    spatial_embeddings.append(x)
                
                # Stack: [num_nodes, seq_len, hidden_dim]
                temporal_input = torch.stack(spatial_embeddings, dim=1)
                
                # LSTM
                temporal_output, _ = self.lstm(temporal_input)
                
                # Take last timestep
                final_embedding = temporal_output[:, -1, :]
            
            else:
                # Single graph (no temporal)
                final_embedding = self.forward_spatial(data.x, data.edge_index)
            
            # Predictions
            pm25_pred = self.regression_head(final_embedding)
            hotspot_logits = self.classification_head(final_embedding)
            
            return pm25_pred, hotspot_logits
        
        def predict(self, data, use_temporal=False):
            """
            Make predictions (inference mode).
            
            Returns:
                pm25_values: Predicted PM2.5 values
                hotspot_probs: Hotspot probabilities
                hotspot_labels: Hotspot predictions (0 or 1)
            """
            self.eval()
            
            with torch.no_grad():
                pm25_pred, hotspot_logits = self.forward(data, use_temporal)
                
                # Convert to probabilities
                hotspot_probs = F.softmax(hotspot_logits, dim=1)[:, 1]
                hotspot_labels = (hotspot_probs > 0.5).long()
                
                return pm25_pred.squeeze(), hotspot_probs, hotspot_labels


else:
    # Placeholder when PyTorch not available
    class SpatioTemporalGNN:
        def __init__(self, *args, **kwargs):
            raise ImportError(
                "PyTorch and PyTorch Geometric required for ST-GNN. "
                "Install with: uv pip install torch torch-geometric"
            )
