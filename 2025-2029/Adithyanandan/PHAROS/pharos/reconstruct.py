import numpy as np

from pharos.zernike import zernike_basis, zernike_gradients_at_subapertures


def build_zernike_interaction_matrix(subapertures, n_modes: int,
                                     pupil_radius_px: float) -> np.ndarray:
    """
    Build interaction matrix D of shape (2*N_active, n_modes).

    Row ordering: first N_active rows are x-slopes, next N_active are y-slopes.
    Each column j is the slope response to unit amplitude of Zernike mode j.
    """
    npix = int(2 * pupil_radius_px)
    basis = zernike_basis(n_modes, npix)
    D_sub = zernike_gradients_at_subapertures(
        subapertures, n_modes, pupil_radius_px, basis=basis
    )
    N = D_sub.shape[0]
    D = np.zeros((2 * N, n_modes), dtype=np.float32)
    D[:N, :] = D_sub[:, :, 0]   # x-slopes
    D[N:, :] = D_sub[:, :, 1]   # y-slopes
    return D


def build_reconstructor(D: np.ndarray, rcond: float = 1e-3) -> np.ndarray:
    """
    Pseudo-inverse reconstructor R = D⁺ via truncated SVD.
    Shape: (n_modes, 2*N_active).
    """
    U, s, Vt = np.linalg.svd(D, full_matrices=False)
    s_inv = np.where(s > rcond * s.max(), 1.0 / s, 0.0)
    R = Vt.T @ np.diag(s_inv) @ U.T
    return R.astype(np.float32)


def reconstruct_wavefront(s: np.ndarray, R: np.ndarray,
                           zernike_basis_arr: np.ndarray) -> tuple:
    """
    s: slope vector (2*N_active,)
    R: reconstructor (n_modes, 2*N_active)
    zernike_basis_arr: (n_modes, H, W)

    Returns:
        coeffs: Zernike coefficient vector (n_modes,)
        phase_map: reconstructed phase on pupil grid (H, W) in radians
    """
    coeffs = R @ s
    phase_map = np.tensordot(coeffs, zernike_basis_arr, axes=([0], [0]))
    return coeffs, phase_map
