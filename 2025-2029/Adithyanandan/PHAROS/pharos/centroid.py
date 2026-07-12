import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

from scipy.optimize import curve_fit


@dataclass
class SubAperture:
    index: Tuple[int, int]
    x0: int
    y0: int
    width: int
    height: int
    active: bool


def build_subaperture_map(config: dict) -> List[SubAperture]:
    nx = config["mla"]["n_lenslets_x"]
    ny = config["mla"]["n_lenslets_y"]
    sub_px = config["_subaperture_size_px"]
    cx = config["pupil"]["centre_x_px"]
    cy = config["pupil"]["centre_y_px"]
    r_pupil = config["pupil"]["diameter_px"] / 2

    subapertures = []
    for i in range(ny):
        for j in range(nx):
            x0 = int(cx - (nx / 2 - j) * sub_px)
            y0 = int(cy - (ny / 2 - i) * sub_px)
            sc_x = x0 + sub_px // 2 - cx
            sc_y = y0 + sub_px // 2 - cy
            active = (sc_x**2 + sc_y**2) < r_pupil**2
            subapertures.append(SubAperture(
                index=(i, j), x0=x0, y0=y0,
                width=sub_px, height=sub_px, active=active,
            ))
    return subapertures


def centroid_com(patch: np.ndarray) -> Tuple[float, float]:
    """Centre of mass."""
    y_idx, x_idx = np.indices(patch.shape)
    total = patch.sum()
    if total == 0:
        return patch.shape[1] / 2.0, patch.shape[0] / 2.0
    cx = (x_idx * patch).sum() / total
    cy = (y_idx * patch).sum() / total
    return float(cx), float(cy)


def centroid_threshold_com(patch: np.ndarray, sigma: float = 3.0) -> Tuple[float, float]:
    """Threshold at mean + sigma*std, then CoM."""
    threshold = patch.mean() + sigma * patch.std()
    patch_t = np.where(patch > threshold, patch - threshold, 0.0)
    return centroid_com(patch_t)


def _gaussian_2d(xy, amplitude, x0, y0, sigma_x, sigma_y, offset):
    x, y = xy
    return (offset + amplitude *
            np.exp(-((x - x0)**2 / (2 * sigma_x**2) + (y - y0)**2 / (2 * sigma_y**2)))).ravel()


def centroid_gaussian_2d(patch: np.ndarray) -> Tuple[float, float]:
    """Fit a 2D Gaussian; falls back to threshold CoM on failure."""
    H, W = patch.shape
    y_idx, x_idx = np.mgrid[:H, :W].astype(float)
    cx0, cy0 = centroid_threshold_com(patch)
    sigma0 = 2.0
    p0 = [patch.max() - patch.min(), cx0, cy0, sigma0, sigma0, patch.min()]
    bounds = ([0, 0, 0, 0.5, 0.5, 0], [np.inf, W, H, W, H, patch.max()])
    try:
        popt, _ = curve_fit(_gaussian_2d, (x_idx, y_idx), patch.ravel(),
                            p0=p0, bounds=bounds, maxfev=1000)
        return float(popt[1]), float(popt[2])
    except RuntimeError:
        return centroid_threshold_com(patch)


def compute_centroids_vectorised(frame: np.ndarray,
                                  active_sas: List[SubAperture],
                                  sigma: float = 3.0) -> np.ndarray:
    """Vectorised threshold-CoM across all active subapertures (~4.5ms vs ~9ms)."""
    N = len(active_sas)
    H = active_sas[0].height
    W = active_sas[0].width
    patches = np.stack([frame[sa.y0:sa.y0 + H, sa.x0:sa.x0 + W] for sa in active_sas])  # (N,H,W)
    flat_p = patches.reshape(N, -1)
    mu = flat_p.mean(axis=1, keepdims=True)
    std = flat_p.std(axis=1, keepdims=True)
    thresh = mu + sigma * std
    val = np.where(flat_p > thresh, flat_p - thresh, 0.0).reshape(N, H, W)
    total = val.sum(axis=(1, 2))
    safe_total = np.where(total > 0, total, 1.0)
    xi = np.arange(W, dtype=np.float32)
    yi = np.arange(H, dtype=np.float32)
    cx = (val * xi[None, None, :]).sum(axis=(1, 2)) / safe_total
    cy = (val * yi[None, :, None]).sum(axis=(1, 2)) / safe_total
    ox = np.array([sa.x0 for sa in active_sas], dtype=np.float32)
    oy = np.array([sa.y0 for sa in active_sas], dtype=np.float32)
    return np.column_stack([cx + ox, cy + oy])


def compute_centroids(frame: np.ndarray,
                      subapertures: List[SubAperture],
                      method: str = "threshold_com",
                      sigma: float = 3.0) -> np.ndarray:
    """Return array of shape (N_active, 2) with (cx, cy) in global pixel coords."""
    centroids = []
    for sa in subapertures:
        if not sa.active:
            continue
        patch = frame[sa.y0:sa.y0 + sa.height, sa.x0:sa.x0 + sa.width]
        if method == "gaussian":
            lcx, lcy = centroid_gaussian_2d(patch)
        elif method == "com":
            lcx, lcy = centroid_com(patch)
        else:
            lcx, lcy = centroid_threshold_com(patch, sigma)
        centroids.append([lcx + sa.x0, lcy + sa.y0])
    return np.array(centroids, dtype=np.float32)
