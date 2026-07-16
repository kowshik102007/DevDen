
import os
import sys
import torch
import numpy as np
import logging
import asyncio
import re
from pathlib import Path

# Setup path
sys.path.insert(0, os.getcwd())

from backend.app.ml.graph_builder import graph_builder
from backend.app.ml.st_gnn import BayesianSTGNN, gaussian_nll_loss

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Absolute models directory (relative to this file, not CWD)
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

async def train_city(
    city: str,
    seq_len: int = 12,
    num_epochs: int = 30,
    batch_size: int = 16,
    lr: float = 0.005,
    val_split: float = 0.15,
    hidden_dim: int = 32,
) -> bool:
    """
    Train a city-specific Bayesian ST-GNN model.

    Tries to load real historical data from the measurements table first;
    falls back to simulated diurnal data if the DB has fewer than seq_len+2 rows.

    Returns True on success, False on failure.
    """
    logger.info(f"🚀 Preparing training for: {city}")

    # ------------------------------------------------------------------ #
    # 1. Build base graph topology                                         #
    # ------------------------------------------------------------------ #
    graph = await graph_builder.build_city_graph(city, wind_dir_deg=270.0)
    if not graph or graph.num_nodes == 0:
        logger.error(f"No graph for {city}. Ingest data first.")
        return False

    num_nodes = graph.num_nodes
    num_features = graph.num_node_features
    edge_index = graph.edge_index
    edge_attr = graph.edge_attr[:, 0]  # weight column

    # ------------------------------------------------------------------ #
    # 2. Build temporal sequence (real data preferred, fallback synthetic) #
    # ------------------------------------------------------------------ #
    x_sequence = _load_real_sequence(city, num_nodes, num_features)

    if x_sequence is None or len(x_sequence) < seq_len + 2:
        logger.warning("Not enough real historical data; using synthetic diurnal simulation.")
        x_sequence = _simulate_sequence(graph.x.numpy(), total_timesteps=24 * 7)

    x_tensor = torch.tensor(np.array(x_sequence, dtype=np.float32))
    total_timesteps = x_tensor.shape[0]

    # ------------------------------------------------------------------ #
    # 3. Normalise (save scaler for inference)                             #
    # ------------------------------------------------------------------ #
    mean = x_tensor.mean(dim=(0, 1), keepdim=True)   # [1, 1, Features]
    std  = x_tensor.std(dim=(0, 1), keepdim=True)
    std[std == 0] = 1.0
    x_tensor = (x_tensor - mean) / std
    logger.info("Data normalised (μ=0, σ=1)")

    # ------------------------------------------------------------------ #
    # 4. Build sliding-window dataset                                      #
    # ------------------------------------------------------------------ #
    target_idx = 0  # PM2.5 is feature index 0
    inputs, targets = [], []

    for i in range(total_timesteps - seq_len - 1):
        inputs.append(x_tensor[i : i + seq_len])
        targets.append(x_tensor[i + seq_len, :, target_idx].unsqueeze(1))

    inputs  = torch.stack(inputs)   # [N, SeqLen, Nodes, Features]
    targets = torch.stack(targets)  # [N, Nodes, 1]

    # ------------------------------------------------------------------ #
    # 5. Train / validation split                                          #
    # ------------------------------------------------------------------ #
    n_total = len(inputs)
    n_val   = max(1, int(n_total * val_split))
    n_train = n_total - n_val

    train_x, val_x = inputs[:n_train], inputs[n_train:]
    train_y, val_y = targets[:n_train], targets[n_train:]
    logger.info(f"Dataset: {n_train} train / {n_val} val windows")

    # ------------------------------------------------------------------ #
    # 6. Model, optimiser, scheduler                                       #
    # ------------------------------------------------------------------ #
    model     = BayesianSTGNN(num_features=num_features, hidden_dim=hidden_dim, output_dim=1)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=5, verbose=True
    )

    best_val_loss   = float('inf')
    best_state_dict = None

    # ------------------------------------------------------------------ #
    # 7. Training loop (fixed gradient accumulation)                       #
    # ------------------------------------------------------------------ #
    logger.info("Starting training loop…")

    for epoch in range(num_epochs):
        model.train()
        epoch_loss   = 0.0
        n_batches    = 0
        permutation  = torch.randperm(n_train)

        for i in range(0, n_train, batch_size):
            indices  = permutation[i : i + batch_size]
            batch_x  = train_x[indices]   # [B, SeqLen, Nodes, Features]
            batch_y  = train_y[indices]   # [B, Nodes, 1]

            # ---- zero grad once per mini-batch (FIXED) ---- #
            optimizer.zero_grad()

            batch_loss = torch.tensor(0.0, requires_grad=True)
            for b in range(len(indices)):
                mu, _, log_var = model(batch_x[b], edge_index, edge_attr, seq_len=seq_len)
                batch_loss = batch_loss + gaussian_nll_loss(mu, log_var, batch_y[b])

            batch_loss = batch_loss / len(indices)
            batch_loss.backward()
            # Gradient clipping prevents NLL explosion
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            epoch_loss += batch_loss.item()
            n_batches  += 1

        avg_train_loss = epoch_loss / max(n_batches, 1)

        # ---- validation ---- #
        model.eval()
        with torch.no_grad():
            val_loss = 0.0
            for b in range(len(val_x)):
                mu, _, log_var = model(val_x[b], edge_index, edge_attr, seq_len=seq_len)
                val_loss += gaussian_nll_loss(mu, log_var, val_y[b]).item()
            avg_val_loss = val_loss / max(len(val_x), 1)

        scheduler.step(avg_val_loss)

        if avg_val_loss < best_val_loss:
            best_val_loss   = avg_val_loss
            best_state_dict = {k: v.clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == num_epochs - 1:
            logger.info(
                f"Epoch {epoch:3d}/{num_epochs} | "
                f"train_loss={avg_train_loss:.4f} | "
                f"val_loss={avg_val_loss:.4f} | "
                f"best_val={best_val_loss:.4f}"
            )

    # ------------------------------------------------------------------ #
    # 8. Save best model + scaler (versioned)                              #
    # ------------------------------------------------------------------ #
    import json
    from datetime import datetime as _dt

    city_slug    = re.sub(r'[^a-z0-9]', '_', city.lower())
    timestamp    = _dt.utcnow().strftime("%Y%m%dT%H%M%S")
    val_tag      = f"{best_val_loss:.4f}".replace(".", "p")

    # Versioned checkpoint paths
    versioned_weights = MODELS_DIR / f"{city_slug}_{timestamp}_val{val_tag}_weights.pt"
    versioned_scaler  = MODELS_DIR / f"{city_slug}_{timestamp}_val{val_tag}_scaler.pt"

    # Stable "latest" symlink targets (overwritten each run)
    weights_path = MODELS_DIR / f"{city_slug}_weights.pt"
    scaler_path  = MODELS_DIR / f"{city_slug}_scaler.pt"

    # Load best weights before saving
    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)

    scaler_payload = {
        'mean': mean,
        'std':  std,
        'num_features': num_features,
        'hidden_dim':   hidden_dim,
        'seq_len':      seq_len,
        'best_val_loss': best_val_loss,
        'city': city,
    }

    # Write versioned checkpoints
    torch.save(model.state_dict(), versioned_weights)
    torch.save(scaler_payload, versioned_scaler)

    # Overwrite the "latest" stable paths so downstream code still works
    torch.save(model.state_dict(), weights_path)
    torch.save(scaler_payload, scaler_path)

    # Maintain a JSON manifest tracking all versions and the current best
    manifest_path = MODELS_DIR / f"{city_slug}_manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"versions": []}
    except Exception:
        manifest = {"versions": []}

    manifest["versions"].append({
        "timestamp": timestamp,
        "val_loss": best_val_loss,
        "weights": versioned_weights.name,
        "scaler": versioned_scaler.name,
    })
    # Keep the entry with the lowest val_loss as the best
    manifest["best"] = min(manifest["versions"], key=lambda v: v["val_loss"])
    manifest_path.write_text(json.dumps(manifest, indent=2))

    logger.info(
        f"✅ Saved best model (val_loss={best_val_loss:.4f}) → {versioned_weights.name} "
        f"(+ stable link {weights_path.name})"
    )
    return True


# -------------------------------------------------------------------------- #
# Helper: load real measurements from Supabase                               #
# -------------------------------------------------------------------------- #
def _load_real_sequence(city: str, num_nodes: int, num_features: int):
    """
    Attempt to load real per-hour measurements from the DB.

    Returns a list of numpy arrays [num_nodes, num_features] ordered by time,
    or None if the query fails / returns insufficient data.
    """
    try:
        from backend.app.services.supabase import get_supabase
        supabase = get_supabase()
        if not supabase:
            return None

        result = (
            supabase.table("measurements")
            .select("site_id, measured_at, pm25, pm10, no2, so2, co, o3, temperature")
            .eq("city", city)
            .order("measured_at", desc=False)
            .limit(5000)
            .execute()
        )

        rows = result.data or []
        if not rows:
            return None

        # Pivot rows into hourly timesteps: group by hour bucket
        from collections import defaultdict
        import datetime as dt

        buckets = defaultdict(list)
        for row in rows:
            ts = row.get("measured_at", "")[:13]  # 'YYYY-MM-DDTHH'
            buckets[ts].append(row)

        if len(buckets) < 14:  # need at least seq_len+2
            return None

        sequence = []
        for ts in sorted(buckets.keys()):
            snapshot = np.zeros((num_nodes, num_features), dtype=np.float32)
            for rec in buckets[ts]:
                # Map to node index via round-robin (simplified — proper join needs cell_id mapping)
                idx = hash(rec.get("site_id", "")) % num_nodes
                feature_vals = [
                    rec.get("pm25") or 0.0,
                    rec.get("pm10") or 0.0,
                    rec.get("no2")  or 0.0,
                    rec.get("so2")  or 0.0,
                    rec.get("co")   or 0.0,
                    rec.get("o3")   or 0.0,
                    rec.get("temperature") or 25.0,
                ]
                # Fill first 7 features; leave extras as 0
                for fi, val in enumerate(feature_vals[:min(7, num_features)]):
                    snapshot[idx, fi] = float(val)
            sequence.append(snapshot)

        logger.info(f"Loaded {len(sequence)} real hourly snapshots for {city}")
        return sequence

    except Exception as e:
        logger.warning(f"Real data load failed ({e}); will simulate.")
        return None


# -------------------------------------------------------------------------- #
# Helper: simulate diurnal sequence from a single DB snapshot                #
# -------------------------------------------------------------------------- #
def _simulate_sequence(base_x: np.ndarray, total_timesteps: int = 168) -> list:
    """
    Simulate a diurnal PM2.5 cycle from a spatial snapshot.

    Only modulates pollution indices (0-5), NOT temperature/humidity.
    """
    num_nodes, num_features = base_x.shape
    sequence = []

    for t in range(total_timesteps):
        hour           = t % 24
        morning_peak   = np.exp(-((hour - 9) ** 2) / 8)
        evening_peak   = np.exp(-((hour - 18) ** 2) / 8)
        pollution_factor = 1.0 + 0.5 * (morning_peak + evening_peak)

        snapshot = base_x.copy()
        noise    = np.random.normal(0, 0.01, (num_nodes, num_features))

        # Only modulate pollution features (indices 0-5), not temperature/humidity
        for feat_idx in range(min(6, num_features)):
            snapshot[:, feat_idx] = snapshot[:, feat_idx] * pollution_factor + noise[:, feat_idx]

        # Add small noise to temperature/humidity only (no diurnal multiplier)
        for feat_idx in range(6, min(8, num_features)):
            snapshot[:, feat_idx] = snapshot[:, feat_idx] + noise[:, feat_idx] * 0.1

        sequence.append(snapshot)

    return sequence


if __name__ == "__main__":
    import argparse
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    parser = argparse.ArgumentParser()
    parser.add_argument("--city", type=str, default="Greater Noida")
    args = parser.parse_args()
    asyncio.run(train_city(args.city))

