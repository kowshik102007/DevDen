import numpy as np
import pytest
from pharos.centroid import centroid_com, centroid_threshold_com, build_subaperture_map


def make_gaussian_patch(H=32, W=32, cx=16.3, cy=15.7, sigma=2.0):
    y, x = np.mgrid[:H, :W].astype(float)
    patch = np.exp(-((x - cx)**2 + (y - cy)**2) / (2 * sigma**2))
    return patch.astype(np.float32)


def test_centroid_com_known_position():
    patch = make_gaussian_patch(cx=16.3, cy=15.7)
    gx, gy = centroid_com(patch)
    assert abs(gx - 16.3) < 0.1
    assert abs(gy - 15.7) < 0.1


def test_centroid_threshold_com_known_position():
    patch = make_gaussian_patch(cx=14.8, cy=17.2)
    gx, gy = centroid_threshold_com(patch, sigma=2.0)
    assert abs(gx - 14.8) < 0.15
    assert abs(gy - 17.2) < 0.15


def test_centroid_com_zero_patch():
    patch = np.zeros((16, 16), dtype=np.float32)
    gx, gy = centroid_com(patch)
    assert gx == 8.0
    assert gy == 8.0


def test_build_subaperture_map_count(cfg):
    sas = build_subaperture_map(cfg)
    active = [s for s in sas if s.active]
    assert len(active) > 0
    assert len(active) <= cfg["mla"]["n_lenslets_x"] * cfg["mla"]["n_lenslets_y"]
