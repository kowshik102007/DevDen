"""Stage 6 validation: simulated closed loop with classical and ML-accelerated paths.

Classical mode: preprocess_fast + vectorised_centroids + R@slopes + basis_at_pts
ML mode:        same but replaces R@slopes with WavefrontMLP forward pass

Usage:
    python simulate_loop.py --n-frames 1000 --mode classical
    python simulate_loop.py --n-frames 1000 --mode ml
"""

import sys, time, types
from pathlib import Path
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

# Numba stub so aotools (used by pharos.zernike) works on NumPy 2.5
if 'numba' not in sys.modules:
    _s = types.ModuleType('numba'); _s.njit = lambda *a, **k: (lambda f: f); _s.jit = _s.njit
    sys.modules['numba'] = _s
    sys.modules['numba.core'] = types.ModuleType('numba.core')
    sys.modules['numba.core.types'] = types.ModuleType('numba.core.types')

from pharos.config import load_config
from pharos.preprocess import build_corrector, preprocess_fast
from pharos.centroid import build_subaperture_map, compute_centroids_vectorised
from pharos.slopes import compute_slopes
from pharos.zernike import zernike_basis
from pharos.reconstruct import build_zernike_interaction_matrix, build_reconstructor
from pharos.actuator import load_coupling_matrix, compute_actuator_map, clip_actuator_strokes


def load_frames(raw_dir: Path, limit: int = 200) -> np.ndarray:
    import cv2
    files = sorted(raw_dir.glob("*.png"))[:limit]
    frames = [cv2.imread(str(f), cv2.IMREAD_UNCHANGED).astype(np.float32) for f in files]
    return np.stack(frames)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--config",   default="config/system.yaml")
    parser.add_argument("--n-modes",  type=int, default=20)
    parser.add_argument("--n-frames", type=int, default=1000)
    parser.add_argument("--mode",     choices=["classical", "ml"], default="classical")
    args = parser.parse_args()

    cfg = load_config(args.config)
    dark            = np.load(ROOT / cfg["data"]["dark_frame_path"])
    flat            = np.load(ROOT / cfg["data"]["flat_frame_path"])
    ref_centroids   = np.load(ROOT / cfg["data"]["reference_centroids_path"])
    coupling_matrix = load_coupling_matrix(ROOT / cfg["dm"]["coupling_matrix_path"])

    pupil_r   = cfg["pupil"]["diameter_px"] / 2
    npix      = int(2 * pupil_r)
    focal_px  = cfg["_focal_length_px"]
    stroke_um = cfg["dm"]["stroke_um"]
    cx        = cfg["pupil"]["centre_x_px"]
    cy        = cfg["pupil"]["centre_y_px"]

    sas        = build_subaperture_map(cfg)
    active_sas = [sa for sa in sas if sa.active]

    # ── One-time setup ──────────────────────────────────────────────────────
    print("Setting up pipeline...")
    corrector = build_corrector(flat)

    D_mat = build_zernike_interaction_matrix(sas, args.n_modes, pupil_r)
    R     = build_reconstructor(D_mat)

    basis = zernike_basis(args.n_modes, npix)

    # Pre-compute Zernike values at subaperture centres — skip full 900×900 tensordot
    cols_idx = np.clip((ref_centroids[:, 0] - cx + pupil_r).astype(int), 0, npix - 1)
    rows_idx = np.clip((ref_centroids[:, 1] - cy + pupil_r).astype(int), 0, npix - 1)
    basis_at_pts = basis[:, rows_idx, cols_idx]  # (n_modes, N_active)

    if args.mode == "ml":
        import torch
        from ml.reconstructor.model import WavefrontMLP
        mlp = WavefrontMLP(n_slopes=2 * len(active_sas), n_modes=args.n_modes)
        mlp.load_state_dict(torch.load("ml/reconstructor/model_best.pt", map_location="cpu"))
        mlp.eval()
        def reconstruct(slopes):
            with torch.no_grad():
                t = torch.tensor(slopes, dtype=torch.float32).unsqueeze(0)
                return mlp(t).squeeze(0).numpy()
        label = "ML (WavefrontMLP)"
    else:
        def reconstruct(slopes):
            return R @ slopes
        label = "Classical (SVD)"

    # ── Load raw frames ──────────────────────────────────────────────────────
    print("Loading frames...")
    raw_frames = load_frames(ROOT / cfg["data"]["raw_frames_dir"])
    n_avail = len(raw_frames)
    print(f"  {n_avail} frames loaded, cycling for {args.n_frames} iterations")

    # ── Simulation loop ──────────────────────────────────────────────────────
    print(f"Running {args.n_frames}-frame loop  [{label}]...")
    latencies_ms = []
    dm_log = []

    for i in range(args.n_frames):
        frame = raw_frames[i % n_avail]
        t0 = time.perf_counter()

        pre          = preprocess_fast(frame, dark, corrector)
        cents        = compute_centroids_vectorised(pre, active_sas)
        slopes       = compute_slopes(cents, ref_centroids, focal_px)
        coeffs       = reconstruct(slopes)
        phase_at_pts = basis_at_pts.T @ coeffs
        acts         = compute_actuator_map(phase_at_pts, coupling_matrix)
        acts         = clip_actuator_strokes(acts, stroke_um)

        latencies_ms.append((time.perf_counter() - t0) * 1000)
        dm_log.append(acts)

    lat = np.array(latencies_ms)
    print(f"\nFrames            : {len(lat)}")
    print(f"Median latency    : {np.median(lat):.2f} ms")
    print(f"95th percentile   : {np.percentile(lat, 95):.2f} ms")
    print(f"Max latency       : {np.max(lat):.2f} ms")
    print(f"% frames > 10 ms  : {100*(lat > 10).mean():.1f}%")
    print(f"DM commands logged: {np.array(dm_log).shape}")

    out_dir = ROOT / "data/processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    fname = out_dir / f"latency_{args.mode}.png"
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(lat, bins=50, edgecolor="black")
    ax.axvline(10, color="red", linestyle="--", label="10 ms target")
    ax.axvline(np.median(lat), color="green", linestyle="--",
               label=f"median={np.median(lat):.1f} ms")
    ax.set_xlabel("Latency (ms)")
    ax.set_ylabel("Count")
    ax.set_title(f"Per-frame processing latency — {label}")
    ax.legend()
    fig.tight_layout()
    fig.savefig(fname, dpi=120)
    print(f"Histogram saved: {fname}")


if __name__ == "__main__":
    main()
