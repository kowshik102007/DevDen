"""
Generate (zernike_variance_vector, [r0, tau0]) training pairs for TurbulenceANN.
Run: python ml/turbulence_ann/dataset.py --generate
"""
import sys, numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def generate_dataset(n_samples=50000,
                     n_modes=20,
                     out_path="data/sim/turbulence_dataset.npz"):
    import math
    import numpy as np
    if not hasattr(np, "math"):
        np.math = math

    from pharos.zernike import NOLL_VARIANCE_COEFF

    rng = np.random.default_rng(42)
    wavelength_m = 550e-9

    features, labels = [], []
    for i in range(n_samples):
        # Random atmospheric parameters
        r0_m = rng.uniform(0.05, 0.30)      # 5–30 cm
        v_wind = rng.uniform(5.0, 20.0)     # m/s
        tau0_s = 0.314 * r0_m / v_wind
        D_m = rng.uniform(0.1, 1.0)         # telescope diameter

        # Compute expected Zernike variances for this r0, D
        variances = []
        for j in range(2, n_modes + 2):
            delta_j = NOLL_VARIANCE_COEFF.get(j, 0)
            # Noll (1976): σ²_j [rad²] = Δ_j * (D/r₀)^(5/3)
            var = delta_j * (D_m / r0_m) ** (5/3) if delta_j > 0 else 0.0
            variances.append(var)

        # Add 10% noise to simulate measurement uncertainty
        variances = np.array(variances, dtype=np.float32)
        variances *= rng.uniform(0.9, 1.1, size=variances.shape).astype(np.float32)

        features.append(variances)
        labels.append([r0_m, tau0_s])

        if (i + 1) % 10000 == 0:
            print(f"  {i+1}/{n_samples}")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    np.savez(out_path,
             features=np.array(features, dtype=np.float32),
             labels=np.array(labels, dtype=np.float32))
    print(f"Dataset saved: {out_path}  shape={np.array(features).shape}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--n-samples", type=int, default=50000)
    parser.add_argument("--n-modes", type=int, default=20)
    parser.add_argument("--out", default="data/sim/turbulence_dataset.npz")
    args = parser.parse_args()
    if args.generate:
        generate_dataset(n_samples=args.n_samples, n_modes=args.n_modes, out_path=args.out)
