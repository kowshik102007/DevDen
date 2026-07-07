"""Stage 5: latency and accuracy benchmark — classical vs ML pipeline."""

import sys, time, types
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

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
from pharos.turbulence import estimate_r0_from_zernike


def _load_frames(raw_dir: Path) -> np.ndarray:
    import cv2
    files = sorted(raw_dir.glob("*.png")) + sorted(raw_dir.glob("*.bmp"))
    return np.stack([cv2.imread(str(f), cv2.IMREAD_UNCHANGED).astype(np.float32) for f in files])


def benchmark_pipeline(config_path: str = "config/system.yaml",
                       n_modes: int = 20, n_frames: int = 200):
    cfg            = load_config(config_path)
    dark           = np.load(ROOT / cfg["data"]["dark_frame_path"])
    flat           = np.load(ROOT / cfg["data"]["flat_frame_path"])
    ref_centroids  = np.load(ROOT / cfg["data"]["reference_centroids_path"])

    sas        = build_subaperture_map(cfg)
    active_sas = [sa for sa in sas if sa.active]
    pupil_r    = cfg["pupil"]["diameter_px"] / 2
    npix       = int(2 * pupil_r)
    focal_px   = cfg["_focal_length_px"]
    cx         = cfg["pupil"]["centre_x_px"]
    cy         = cfg["pupil"]["centre_y_px"]

    print("Setting up (one-time)...")
    corrector    = build_corrector(flat)
    D_mat        = build_zernike_interaction_matrix(sas, n_modes, pupil_r)
    R            = build_reconstructor(D_mat)
    basis        = zernike_basis(n_modes, npix)
    cols_idx     = np.clip((ref_centroids[:, 0] - cx + pupil_r).astype(int), 0, npix - 1)
    rows_idx     = np.clip((ref_centroids[:, 1] - cy + pupil_r).astype(int), 0, npix - 1)
    basis_at_pts = basis[:, rows_idx, cols_idx]   # (n_modes, N_active)

    raw  = _load_frames(ROOT / cfg["data"]["raw_frames_dir"])
    N_av = len(raw)
    print(f"  {N_av} frames loaded, cycling for {n_frames} iterations")

    def run(name, reconstruct_fn):
        lats, coeffs_log = [], []
        # Warmup (3 frames, not counted)
        for i in range(3):
            frame = raw[i % N_av]
            preprocess_fast(frame, dark, corrector)
        for i in range(n_frames):
            frame = raw[i % N_av]
            t0    = time.perf_counter()
            pre   = preprocess_fast(frame, dark, corrector)
            cents = compute_centroids_vectorised(pre, active_sas)
            s     = compute_slopes(cents, ref_centroids, focal_px)
            c     = reconstruct_fn(s)
            _     = basis_at_pts.T @ c          # phase at sample pts
            lats.append((time.perf_counter() - t0) * 1000)
            coeffs_log.append(c)
        return np.array(lats), np.array(coeffs_log)

    # ── Classical ────────────────────────────────────────────────────────────
    classical_lats, classical_coeffs = run("Classical", lambda s: R @ s)

    # ── ML ──────────────────────────────────────────────────────────────────
    try:
        import torch
        from ml.reconstructor.model import WavefrontMLP
        mlp = WavefrontMLP(n_slopes=2 * len(active_sas), n_modes=n_modes)
        mlp.load_state_dict(torch.load(ROOT / "ml/reconstructor/model_best.pt", map_location="cpu"))
        mlp.eval()
        # Warmup torch JIT + kernel caches
        dummy = torch.zeros(1, 2 * len(active_sas), dtype=torch.float32)
        for _ in range(20):
            with torch.no_grad(): mlp(dummy)
        def ml_reconstruct(s):
            with torch.no_grad():
                return mlp(torch.tensor(s, dtype=torch.float32).unsqueeze(0)).squeeze(0).numpy()
        ml_lats, ml_coeffs = run("ML", ml_reconstruct)
        has_ml = True
    except Exception as e:
        print(f"ML model unavailable: {e}")
        has_ml = False

    # ── Results ──────────────────────────────────────────────────────────────
    wavelength_m = cfg["atmosphere"]["wavelength_m"]
    D_m = cfg["pupil"]["diameter_px"] * cfg["camera"]["pixel_size_um"] * 1e-6

    print(f"\n{'Pipeline':16s} {'Median':>8} {'p95':>8} {'Max':>8} {'>10ms%':>8} {'r0 cm':>8}")
    print("─" * 62)
    for name, lats, coeffs in [
        ("Classical",    classical_lats,    classical_coeffs),
        *(([("ML (MLP)", ml_lats, ml_coeffs)] if has_ml else [])),
    ]:
        r0 = estimate_r0_from_zernike(coeffs, wavelength_m, D_m)
        pct = 100 * (lats > 10).mean()
        print(f"{name:16s} {np.median(lats):8.2f} {np.percentile(lats,95):8.2f} "
              f"{np.max(lats):8.2f} {pct:8.1f} {r0*100:8.2f}")

    return {"classical": classical_lats, "ml": ml_lats if has_ml else None}


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--n-frames", type=int, default=200)
    p.add_argument("--n-modes",  type=int, default=20)
    args = p.parse_args()
    benchmark_pipeline(n_frames=args.n_frames, n_modes=args.n_modes)
