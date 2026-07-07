"""Zernike polynomial utilities wrapping aotools (Noll ordering)."""

import math
import numpy as np

# aotools uses numpy.math.factorial which was removed in NumPy 2.0 — patch the alias
if not hasattr(np, "math"):
    np.math = math  # type: ignore[attr-defined]

try:
    import aotools
    _HAS_AOTOOLS = True
except ImportError:
    _HAS_AOTOOLS = False


def zernike_basis(n_modes: int, npix: int) -> np.ndarray:
    """
    Return Zernike basis array of shape (n_modes, npix, npix).
    Modes are 1-indexed in Noll ordering (mode 1 = piston, 2 = tip, 3 = tilt …).
    """
    if not _HAS_AOTOOLS:
        raise ImportError("aotools is required: pip install aotools")
    basis = aotools.zernikeArray(n_modes, npix, norm=True)
    return basis.astype(np.float32)


def zernike_gradients_at_subapertures(subapertures, n_modes: int,
                                      pupil_radius_px: float,
                                      basis: np.ndarray = None) -> np.ndarray:
    """
    Compute mean x and y gradients of each Zernike mode over each active subaperture.

    Returns D_sub of shape (N_active, n_modes, 2):
        D_sub[i, j, 0] = mean dZ_j/dx over subaperture i
        D_sub[i, j, 1] = mean dZ_j/dy over subaperture i
    """
    if basis is None:
        npix = int(2 * pupil_radius_px)
        basis = zernike_basis(n_modes, npix)

    npix = basis.shape[1]

    # Numerical gradient over the full pupil plane
    dZ_dx = np.gradient(basis, axis=2)  # (n_modes, npix, npix)
    dZ_dy = np.gradient(basis, axis=1)

    active_sas = [sa for sa in subapertures if sa.active]
    N = len(active_sas)
    D_sub = np.zeros((N, n_modes, 2), dtype=np.float32)

    scale = npix / (2 * pupil_radius_px)

    for i, sa in enumerate(active_sas):
        sa_cx = sa.x0 + sa.width / 2
        sa_cy = sa.y0 + sa.height / 2
        bx_c = int(np.clip(sa_cx * scale, 1, npix - 2))
        by_c = int(np.clip(sa_cy * scale, 1, npix - 2))
        half_w = max(1, int(sa.width * scale / 2))
        half_h = max(1, int(sa.height * scale / 2))

        roi_dx = dZ_dx[:, by_c - half_h:by_c + half_h, bx_c - half_w:bx_c + half_w]
        roi_dy = dZ_dy[:, by_c - half_h:by_c + half_h, bx_c - half_w:bx_c + half_w]

        if roi_dx.size > 0:
            D_sub[i, :, 0] = roi_dx.mean(axis=(1, 2))
            D_sub[i, :, 1] = roi_dy.mean(axis=(1, 2))

    return D_sub


# Extended Noll (1976) variance coefficients Δ_j for modes 2–36
NOLL_VARIANCE_COEFF = {
    2: 0.448, 3: 0.448,
    4: 0.023, 5: 0.023,
    6: 0.0062, 7: 0.0062,
    8: 0.0023, 9: 0.0023, 10: 0.0023,
    11: 0.00072, 12: 0.00072, 13: 0.00072,
    14: 0.00025, 15: 0.00025, 16: 0.00025, 17: 0.00025,
    18: 0.000095, 19: 0.000095, 20: 0.000095, 21: 0.000095,
    22: 0.000038, 23: 0.000038, 24: 0.000038,
    25: 0.000038, 26: 0.000038,
    27: 0.000016, 28: 0.000016, 29: 0.000016,
    30: 0.000016, 31: 0.000016, 32: 0.000016,
    33: 0.0000069, 34: 0.0000069, 35: 0.0000069, 36: 0.0000069,
}
