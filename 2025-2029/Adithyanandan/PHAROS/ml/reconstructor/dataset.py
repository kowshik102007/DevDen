"""
Dataset for the wavefront reconstructor MLP.
Generates (slope_vector, zernike_coefficients) pairs via direct Kolmogorov sampling.

Instead of generating full phase screens (slow), we:
  1. Sample Zernike coefficients from Kolmogorov statistics: c_j ~ N(0, sqrt(Δ_j*(D/r0)^(5/3)))
  2. Pre-compute the mean x/y gradient of each Zernike mode over each subaperture once
  3. Slopes = interaction_matrix @ coefficients  (fast matrix multiply)

Pre-generate with: python ml/reconstructor/dataset.py --generate
"""

import numpy as np
from pathlib import Path

try:
    import torch
    from torch.utils.data import Dataset

    class ReconstructorDataset(Dataset):
        def __init__(self, data_path: str = "data/sim/reconstructor_dataset.npz"):
            data = np.load(data_path)
            self.slopes = torch.tensor(data["slopes"], dtype=torch.float32)
            self.coeffs = torch.tensor(data["coeffs"], dtype=torch.float32)

        def __len__(self):
            return len(self.slopes)

        def __getitem__(self, idx):
            return self.slopes[idx], self.coeffs[idx]

except ImportError:
    pass


def _build_interaction_matrix(cfg, sas, basis, npix):
    """Build (2*N_active, n_modes) interaction matrix: mean x/y gradient per subaperture."""
    sub_px = cfg["_subaperture_size_px"]
    active_sas = [sa for sa in sas if sa.active]
    N = len(active_sas)
    n_modes = basis.shape[0]

    pupil_r = cfg["pupil"]["diameter_px"] / 2
    x_offset = int(cfg["pupil"]["centre_x_px"] - pupil_r)
    y_offset = int(cfg["pupil"]["centre_y_px"] - pupil_r)

    # Pre-compute gradients of each Zernike mode (shape: n_modes, 2, npix, npix)
    # axis=1 → dx, axis=0 → dy
    dx_basis = np.gradient(basis, axis=2)   # (n_modes, npix, npix)
    dy_basis = np.gradient(basis, axis=1)

    D = np.zeros((2 * N, n_modes), dtype=np.float32)
    for k, sa in enumerate(active_sas):
        bx = min(max(sa.x0 - x_offset, 0), npix - 1)
        by = min(max(sa.y0 - y_offset, 0), npix - 1)
        bw = min(sub_px, npix - bx)
        bh = min(sub_px, npix - by)
        D[k]     = dx_basis[:, by:by+bh, bx:bx+bw].reshape(n_modes, -1).mean(axis=1)
        D[N + k] = dy_basis[:, by:by+bh, bx:bx+bw].reshape(n_modes, -1).mean(axis=1)
    return D, active_sas


def generate_dataset(config_path: str = "config/system.yaml",
                     n_samples: int = 10000,
                     n_modes: int = 20,
                     out_path: str = "data/sim/reconstructor_dataset.npz"):
    """Generate (slopes, zernike_coefficients) training pairs via Kolmogorov statistics."""
    import sys, types
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    # Stub numba so aotools (used internally by pharos.zernike) doesn't fail on NumPy 2.5
    if 'numba' not in sys.modules:
        _stub = types.ModuleType('numba')
        _stub.njit = lambda *a, **kw: (lambda f: f)
        _stub.jit = lambda *a, **kw: (lambda f: f)
        sys.modules['numba'] = _stub
        sys.modules['numba.core'] = types.ModuleType('numba.core')
        sys.modules['numba.core.types'] = types.ModuleType('numba.core.types')
    from pharos.config import load_config
    from pharos.centroid import build_subaperture_map
    from pharos.zernike import zernike_basis, NOLL_VARIANCE_COEFF

    cfg = load_config(config_path)
    sas = build_subaperture_map(cfg)
    pupil_r = cfg["pupil"]["diameter_px"] / 2
    npix = int(2 * pupil_r)
    D_m = 0.3  # telescope entrance pupil diameter in metres

    print("Building Zernike basis...")
    basis = zernike_basis(n_modes, npix)

    print("Building interaction matrix...")
    D_mat, active_sas = _build_interaction_matrix(cfg, sas, basis, npix)
    print(f"  D_mat shape: {D_mat.shape}")

    # Kolmogorov standard deviations: σ_j = sqrt(Δ_j * (D/r0)^(5/3))
    delta = np.array([NOLL_VARIANCE_COEFF.get(j + 2, 0.0) for j in range(n_modes)],
                     dtype=np.float64)

    rng = np.random.default_rng(42)
    r0_samples = rng.uniform(0.05, 0.30, n_samples)  # 5–30 cm

    # Batch-sample all coefficients at once
    # σ_j(r0) = sqrt(Δ_j) * (D/r0)^(5/6)
    sigmas = np.sqrt(delta[None, :]) * (D_m / r0_samples[:, None]) ** (5.0 / 6.0)  # (n_samples, n_modes)
    std_noise = rng.standard_normal((n_samples, n_modes)).astype(np.float32)
    coeffs = (sigmas * std_noise).astype(np.float32)

    # Slopes = D_mat @ coeffs^T  →  (2N, n_samples)  → transpose
    slopes = (D_mat @ coeffs.T).T.astype(np.float32)

    # Add 5% Gaussian read noise to slopes
    slopes += rng.normal(0, 0.05 * np.abs(slopes).mean(), slopes.shape).astype(np.float32)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    np.savez(out_path, slopes=slopes, coeffs=coeffs)
    print(f"Dataset saved: {out_path}  slopes={slopes.shape}  coeffs={coeffs.shape}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--n-samples", type=int, default=10000)
    parser.add_argument("--n-modes", type=int, default=20)
    parser.add_argument("--out", default="data/sim/reconstructor_dataset.npz")
    args = parser.parse_args()
    if args.generate:
        generate_dataset(n_samples=args.n_samples, n_modes=args.n_modes, out_path=args.out)
