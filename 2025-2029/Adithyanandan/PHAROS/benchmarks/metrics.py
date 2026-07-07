import numpy as np


def rms_wavefront_error(phase_map: np.ndarray, mask: np.ndarray) -> float:
    return float(np.sqrt(np.mean(phase_map[mask] ** 2)))


def strehl_ratio(phase_map: np.ndarray, mask: np.ndarray) -> float:
    """Marechal approximation S ≈ exp(-σ²_φ). Valid for RMS < λ/14."""
    sigma_sq = np.mean(phase_map[mask] ** 2)
    return float(np.exp(-sigma_sq))


def phase_structure_function(phase_map: np.ndarray, mask: np.ndarray = None) -> np.ndarray:
    """
    D_φ(r) = 2*(AC(0) - AC(r)) via FFT. O(N² log N).
    Returns 2D structure function array same shape as phase_map.
    """
    if mask is not None:
        phi = np.where(mask, phase_map, 0.0)
    else:
        phi = phase_map
    F = np.fft.fft2(phi)
    AC = np.real(np.fft.ifft2(np.abs(F) ** 2)) / phi.size
    AC = np.fft.fftshift(AC)
    D = 2.0 * (AC.max() - AC)
    return D.astype(np.float32)
