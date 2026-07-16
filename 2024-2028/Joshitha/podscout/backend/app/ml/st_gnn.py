
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv

class BayesianSTGNN(nn.Module):
    """
    Spatio-Temporal Graph Neural Network with Bayesian Output Head.
    
    Architecture:
    1. Spatial Encoder: GCN layers (with dynamic edge weights)
    2. Temporal Encoder: GRU to capture time-series patterns
    3. Bayesian Head: Predicts Mean (mu) and Uncertainty (sigma)
    """
    def __init__(self, num_features, hidden_dim=64, output_dim=1):
        super().__init__()
        # Spatial Encoder
        self.gnn1 = GCNConv(num_features, hidden_dim)
        self.gnn2 = GCNConv(hidden_dim, hidden_dim)
        
        # Temporal Encoder (Batch First)
        # Input: [Batch, Seq, Hidden]
        self.gru = nn.GRU(hidden_dim, hidden_dim, batch_first=True)
        
        # Bayesian Heads
        self.fc_mu = nn.Linear(hidden_dim, output_dim)
        self.fc_var = nn.Linear(hidden_dim, output_dim) # Predict Log Variance
        
        self.dropout = nn.Dropout(0.3)

    def forward(self, x, edge_index, edge_weight, seq_len):
        """
        Args:
            x: Input tensor [SeqLen, NumNodes, Features]
            edge_index: Graph connectivity [2, NumEdges]
            edge_weight: Dynamic edge weights [NumEdges]
            seq_len: Length of time sequence
        """
        # We process each time-step with the GNN (Weights shared)
        h_list = []
        for t in range(seq_len):
            xt = x[t] # [NumNodes, Features]
            
            # GNN Layer 1
            ht = self.gnn1(xt, edge_index, edge_weight=edge_weight)
            ht = F.silu(ht)
            ht = self.dropout(ht)
            
            # GNN Layer 2
            ht = self.gnn2(ht, edge_index, edge_weight=edge_weight)
            ht = F.silu(ht)
            
            h_list.append(ht.unsqueeze(0)) # [1, NumNodes, Hidden]
            
        # Stack: [SeqLen, NumNodes, Hidden]
        h_seq = torch.cat(h_list, dim=0)
        
        # Permute for GRU: [NumNodes, SeqLen, Hidden] (Treat Nodes as Batch)
        h_seq = h_seq.permute(1, 0, 2)
        
        # Temporal Encoder
        out, h_n = self.gru(h_seq)
        
        # Take last state: [NumNodes, Hidden]
        last_h = h_n[-1] 
        
        # Bayesian Heads
        mu = self.fc_mu(last_h)
        log_var = self.fc_var(last_h)
        
        # Convert log_var to sigma for inference convenience
        sigma = torch.exp(0.5 * log_var)
        
        return mu, sigma, log_var

def gaussian_nll_loss(mu, log_var, target):
    """
    Negative Log Likelihood Loss for Gaussian Distribution.
    L = 0.5 * (log(var) + (target - mu)^2 / var) + const

    log_var is clamped to [-10, 10] to prevent numerical instability
    (inf/nan from exp of very negative/positive values).
    """
    log_var = torch.clamp(log_var, min=-10.0, max=10.0)
    var = torch.exp(log_var)
    # Add small epsilon to prevent div-by-zero if var is extremely small
    var = var + 1e-8
    loss = 0.5 * (log_var + (target - mu) ** 2 / var)
    return loss.mean()
