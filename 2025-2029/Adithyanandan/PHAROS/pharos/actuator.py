import numpy as np
from scipy.linalg import lstsq


def load_coupling_matrix(path: str) -> np.ndarray:
    """Load DM influence/coupling matrix I of shape (N_phase_pts, N_actuators)."""
    return np.load(path)


def compute_actuator_map(phase_map: np.ndarray,
                          coupling_matrix: np.ndarray,
                          pupil_mask: np.ndarray = None,
                          rcond: float = 1e-3) -> np.ndarray:
    """
    Solve I @ a = -W for actuator stroke vector a.

    phase_map: (H, W) reconstructed phase in radians
    coupling_matrix: (N_phase_pts, N_actuators)
    pupil_mask: boolean (H, W) mask selecting valid phase evaluation points
    Returns: a of shape (N_actuators,)
    """
    if pupil_mask is not None:
        W_flat = -phase_map[pupil_mask].ravel()
    else:
        W_flat = -phase_map.ravel()

    a, _, _, _ = lstsq(coupling_matrix, W_flat, cond=rcond)
    return a.astype(np.float32)


def clip_actuator_strokes(a: np.ndarray, stroke_range: float) -> np.ndarray:
    return np.clip(a, -stroke_range, stroke_range)
