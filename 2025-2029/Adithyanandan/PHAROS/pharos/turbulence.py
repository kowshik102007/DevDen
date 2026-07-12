import numpy as np
from scipy.signal import welch
from scipy.optimize import curve_fit

from pharos.zernike import NOLL_VARIANCE_COEFF


def estimate_r0_from_zernike(coeffs_series: np.ndarray,
                              wavelength_m: float,
                              D_m: float,
                              exclude_tip_tilt: bool = True) -> float:
    """
    Estimate Fried parameter r₀ from variance of Zernike coefficients.
    Uses Noll (1976): Var(Z_j) = 0.2944 * Δ_j * (D/r₀)^(5/3) * λ²

    coeffs_series: (N_frames, n_modes) — Noll 1-indexed, mode index = column + 1
    """
    variances = np.var(coeffs_series, axis=0)
    r0_estimates = []
    for j, delta_j in NOLL_VARIANCE_COEFF.items():
        if exclude_tip_tilt and j in (2, 3):
            continue
        idx = j - 1
        if idx >= len(variances) or delta_j <= 0:
            continue
        var_j = variances[idx]
        if var_j <= 0:
            continue
        # Noll (1976): σ²_j [rad²] = Δ_j * (D/r₀)^(5/3)
        # Δ_j already encodes the 0.2944 constant for high-j modes.
        # No λ² factor: coefficients from slope reconstruction are in radians.
        ratio = var_j / delta_j
        r0 = D_m * ratio ** (-3.0 / 5.0)
        r0_estimates.append(r0)
    if not r0_estimates:
        return float("nan")
    return float(np.median(r0_estimates))


def estimate_tau0(slopes_series: np.ndarray, frame_rate_hz: float) -> float:
    """
    Estimate coherence time τ₀ from temporal PSD of slope measurements.
    Fits f^(-8/3) power law to the Welch PSD knee frequency.

    slopes_series: (N_frames, 2*N_active) or (N_frames,)
    """
    if slopes_series.ndim > 1:
        signal = slopes_series.mean(axis=1)
    else:
        signal = slopes_series

    freqs, psd = welch(signal, fs=frame_rate_hz, nperseg=min(256, len(signal) // 4))

    f_min = freqs[1]
    f_max = freqs[-1] / 10.0
    mask = (freqs > f_min) & (freqs < f_max) & (psd > 0)
    if mask.sum() < 3:
        return float("nan")

    def power_law(f, A, f0):
        return A * (f / f0) ** (-8.0 / 3.0)

    try:
        f_fit = freqs[mask]
        psd_fit = psd[mask]
        f0_guess = max(f_fit[np.argmax(psd_fit)], 1e-3)
        popt, _ = curve_fit(power_law, f_fit, psd_fit,
                            p0=[psd_fit.max(), f0_guess],
                            maxfev=2000, bounds=([0, 1e-6], [np.inf, frame_rate_hz]))
        tau0 = 1.0 / (2.0 * np.pi * popt[1])
    except RuntimeError:
        tau0 = float("nan")
    return float(tau0)
