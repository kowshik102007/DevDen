import numpy as np


def compute_slopes(centroids: np.ndarray,
                   reference_centroids: np.ndarray,
                   focal_length_px: float) -> np.ndarray:
    """
    Convert centroid deviations to slope vector in radians.

    Returns s of shape (2*N_active,): all x-slopes concatenated with all y-slopes.
    """
    deviations = centroids - reference_centroids   # (N, 2)
    slopes = deviations / focal_length_px          # pixels → radians
    s = np.concatenate([slopes[:, 0], slopes[:, 1]])
    return s.astype(np.float32)
