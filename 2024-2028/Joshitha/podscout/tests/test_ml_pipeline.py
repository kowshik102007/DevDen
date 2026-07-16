"""
Tests for the Bayesian ST-GNN ML pipeline.
Covers: numerical stability, train_city() fallback path, model versioning manifest.
"""

import json
import re
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
import torch

# ---------------------------------------------------------------------------
# Ensure repo root is on sys.path
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))


# ---------------------------------------------------------------------------
# gaussian_nll_loss — numerical stability
# ---------------------------------------------------------------------------
class TestGaussianNllLoss:
    def _import(self):
        from backend.app.ml.st_gnn import gaussian_nll_loss
        return gaussian_nll_loss

    def test_normal_values(self):
        fn = self._import()
        mu      = torch.zeros(4, 3)
        log_var = torch.zeros(4, 3)
        y       = torch.ones(4, 3)
        loss = fn(mu, log_var, y)
        assert torch.isfinite(loss), "Loss must be finite for normal inputs"

    def test_very_positive_log_var(self):
        """Clamping should prevent log_var=100 from causing inf."""
        fn = self._import()
        mu      = torch.zeros(4, 3)
        log_var = torch.full((4, 3), 100.0)
        y       = torch.ones(4, 3)
        loss = fn(mu, log_var, y)
        assert torch.isfinite(loss)

    def test_very_negative_log_var(self):
        """Clamping should prevent log_var=-100 (near-zero var) from NaN."""
        fn = self._import()
        mu      = torch.zeros(4, 3)
        log_var = torch.full((4, 3), -100.0)
        y       = torch.ones(4, 3)
        loss = fn(mu, log_var, y)
        assert torch.isfinite(loss)

    def test_returns_scalar(self):
        fn = self._import()
        mu      = torch.randn(8, 6)
        log_var = torch.randn(8, 6)
        y       = torch.randn(8, 6)
        loss = fn(mu, log_var, y)
        assert loss.dim() == 0, "Loss should be a scalar tensor"


# ---------------------------------------------------------------------------
# BayesianSTGNN — forward pass smoke test
# ---------------------------------------------------------------------------
class TestBayesianSTGNN:
    def test_forward_shape(self):
        from backend.app.ml.st_gnn import BayesianSTGNN
        model = BayesianSTGNN(num_features=6, hidden_dim=16)
        # Fake graph: 5 nodes, 6 features, 2 bidirectional edges
        num_nodes = 5
        seq_len   = 4
        x         = torch.randn(seq_len, num_nodes, 6)
        edge_index = torch.tensor([[0, 1, 1, 2], [1, 0, 2, 1]], dtype=torch.long)
        edge_attr  = torch.ones(4, 1)

        mu, uncertainty, log_var = model(x, edge_index, edge_attr, seq_len=seq_len)

        assert mu.shape          == (num_nodes, 1), f"mu shape mismatch: {mu.shape}"
        assert uncertainty.shape == (num_nodes, 1)
        assert log_var.shape     == (num_nodes, 1)
        assert torch.isfinite(mu).all(), "mu contains inf/nan"


# ---------------------------------------------------------------------------
# train_city() — simulate-path (no DB) integration
# ---------------------------------------------------------------------------
class TestTrainCity:
    @pytest.mark.asyncio
    async def test_simulate_path_returns_true(self, tmp_path):
        """
        train_city() should succeed when DB is unavailable, falling back to
        _simulate_sequence, and should write versioned checkpoint files.
        """
        from backend.app.ml import train_model as tm

        # Patch MODELS_DIR to a temp directory
        original_models_dir = tm.MODELS_DIR
        tm.MODELS_DIR = tmp_path
        tm.MODELS_DIR.mkdir(parents=True, exist_ok=True)

        # Minimal mock graph: 4 nodes, 6 features
        import torch
        from torch_geometric.data import Data

        mock_graph = Data(
            x=torch.zeros(4, 6),
            edge_index=torch.tensor([[0, 1, 2, 3], [1, 2, 3, 0]], dtype=torch.long),
            edge_attr=torch.ones(4, 1),
            num_nodes=4,
        )

        with patch("backend.app.ml.train_model.graph_builder") as mock_gb, \
             patch("backend.app.ml.train_model._load_real_sequence", return_value=None):
            mock_gb.build_city_graph = AsyncMock(return_value=mock_graph)

            result = await tm.train_city("TestCity", num_epochs=2, batch_size=2)

        tm.MODELS_DIR = original_models_dir

        assert result is True

    @pytest.mark.asyncio
    async def test_model_versioning_creates_manifest(self, tmp_path):
        """Manifest JSON should exist after a successful training run."""
        from backend.app.ml import train_model as tm
        import torch
        from torch_geometric.data import Data

        original_models_dir = tm.MODELS_DIR
        tm.MODELS_DIR = tmp_path

        mock_graph = Data(
            x=torch.zeros(3, 6),
            edge_index=torch.tensor([[0, 1], [1, 0]], dtype=torch.long),
            edge_attr=torch.ones(2, 1),
            num_nodes=3,
        )

        with patch("backend.app.ml.train_model.graph_builder") as mock_gb, \
             patch("backend.app.ml.train_model._load_real_sequence", return_value=None):
            mock_gb.build_city_graph = AsyncMock(return_value=mock_graph)
            await tm.train_city("Manifest City", num_epochs=2, batch_size=2)

        tm.MODELS_DIR = original_models_dir

        manifest_files = list(tmp_path.glob("*_manifest.json"))
        assert len(manifest_files) == 1, "Exactly one manifest file should be created"

        manifest = json.loads(manifest_files[0].read_text())
        assert "versions" in manifest
        assert "best" in manifest
        assert len(manifest["versions"]) == 1
        assert "val_loss" in manifest["best"]
