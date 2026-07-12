import numpy as np
import pytest
from pharos.turbulence import estimate_r0_from_zernike


def test_r0_estimate_reasonable():
    rng = np.random.default_rng(42)
    n_frames, n_modes = 500, 20
    # Simulate Kolmogorov variances for r0 = 0.15 m, D = 0.005 m, lam = 550nm
    wavelength_m = 550e-9
    D_m = 0.005
    r0_true = 0.15

    from pharos.zernike import NOLL_VARIANCE_COEFF
    coeffs_series = np.zeros((n_frames, n_modes), dtype=np.float32)
    for j, delta_j in NOLL_VARIANCE_COEFF.items():
        if j > n_modes:
            break
        # Noll (1976): σ²_j [rad²] = Δ_j * (D/r₀)^(5/3)
        # NOLL_VARIANCE_COEFF values already encode the 0.2944 prefactor.
        var_j = delta_j * (D_m / r0_true) ** (5/3)
        if var_j > 0:
            coeffs_series[:, j - 1] = rng.normal(0, np.sqrt(var_j), n_frames)

    r0_est = estimate_r0_from_zernike(coeffs_series, wavelength_m, D_m)
    assert abs(r0_est - r0_true) / r0_true < 0.3, f"r0 estimate {r0_est:.4f} too far from {r0_true}"


def test_r0_returns_nan_on_zero_variance():
    coeffs_series = np.zeros((10, 5), dtype=np.float32)
    result = estimate_r0_from_zernike(coeffs_series, 550e-9, 0.005)
    assert np.isnan(result)
