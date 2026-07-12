"""Shared pytest fixtures — all synthetic, no hardware data required."""

import numpy as np
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def cfg():
    """Minimal synthetic config for a 4×4 MLA at reduced resolution."""
    return {
        "mla": {"n_lenslets_x": 4, "n_lenslets_y": 4,
                "pitch_mm": 0.3, "focal_length_mm": 18.6},
        "camera": {"pixel_size_um": 5.5, "frame_width_px": 256,
                   "frame_height_px": 256, "bit_depth": 16, "frame_rate_hz": 200.0},
        "pupil": {"diameter_px": 220, "centre_x_px": 128, "centre_y_px": 128},
        "dm": {"n_actuators": 9, "stroke_um": 5.0, "coupling_matrix_path": ""},
        "atmosphere": {"L0_m": 30.0, "l0_m": 0.01, "wavelength_m": 550e-9},
        "data": {"raw_frames_dir": "data/raw/", "dark_frame_path": "",
                 "flat_frame_path": "", "reference_centroids_path": ""},
        "_focal_length_px": 18.6 / 5.5 * 1000,
        "_subaperture_size_px": int(0.3 / 5.5 * 1000),
    }


@pytest.fixture
def dark(cfg):
    H = cfg["camera"]["frame_height_px"]
    W = cfg["camera"]["frame_width_px"]
    return np.full((H, W), 0.002, dtype=np.float32)


@pytest.fixture
def flat(cfg):
    H = cfg["camera"]["frame_height_px"]
    W = cfg["camera"]["frame_width_px"]
    return np.ones((H, W), dtype=np.float32)


@pytest.fixture
def synthetic_frame(cfg):
    """256×256 frame with Gaussian spots on a 4×4 grid."""
    rng = np.random.default_rng(0)
    nx = cfg["mla"]["n_lenslets_x"]
    ny = cfg["mla"]["n_lenslets_y"]
    sub_px = cfg["_subaperture_size_px"]
    cx_frame = cfg["pupil"]["centre_x_px"]
    cy_frame = cfg["pupil"]["centre_y_px"]
    r_pupil = cfg["pupil"]["diameter_px"] / 2
    H = cfg["camera"]["frame_height_px"]
    W = cfg["camera"]["frame_width_px"]

    frame = np.zeros((H, W), dtype=np.float32)
    y_grid, x_grid = np.mgrid[:sub_px, :sub_px].astype(float)
    for i in range(ny):
        for j in range(nx):
            x0 = int(cx_frame - (nx / 2 - j) * sub_px)
            y0 = int(cy_frame - (ny / 2 - i) * sub_px)
            sc_x = x0 + sub_px // 2 - cx_frame
            sc_y = y0 + sub_px // 2 - cy_frame
            if sc_x**2 + sc_y**2 >= r_pupil**2:
                continue
            spot = np.exp(-((x_grid - sub_px/2)**2 + (y_grid - sub_px/2)**2) / 8)
            spot = rng.poisson(spot * 1000).astype(np.float32) / 1000
            y1 = min(y0 + sub_px, H)
            x1 = min(x0 + sub_px, W)
            if y0 >= 0 and x0 >= 0:
                frame[y0:y1, x0:x1] += spot[:y1-y0, :x1-x0]
    return np.clip(frame, 0, 1)
