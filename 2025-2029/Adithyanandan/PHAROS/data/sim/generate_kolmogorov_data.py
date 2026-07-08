"""
Generate physically realistic SH-WFS frames using aotools Kolmogorov phase screens.
Replaces random-displacement approach with proper atmospheric turbulence physics.

Usage:
    python data/sim/generate_kolmogorov_data.py [--n-frames N] [--r0 R0_M]
"""

import argparse
import sys
import math
from pathlib import Path

import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import types as _types
if 'numba' not in sys.modules:
    _s = _types.ModuleType('numba'); _s.njit = lambda *a, **k: (lambda f: f); _s.jit = _s.njit
    sys.modules['numba'] = _s
    sys.modules['numba.core'] = _types.ModuleType('numba.core')
    sys.modules['numba.core.types'] = _types.ModuleType('numba.core.types')

import aotools
if not hasattr(np, "math"):
    np.math = math

from pharos.config import load_config


def gaussian_psf(H, W, cx, cy, sigma=2.0):
    y, x = np.mgrid[:H, :W].astype(float)
    return np.exp(-((x - cx)**2 + (y - cy)**2) / (2 * sigma**2))


def compute_subaperture_slopes(phase_screen, cfg):
    """
    Compute centroid displacements from a phase screen (radians, pixel coords).

    Returns: (N_active, 2) array of (dx_px, dy_px) centroid displacements
    """
    nx = cfg["mla"]["n_lenslets_x"]
    ny = cfg["mla"]["n_lenslets_y"]
    sub_px = cfg["_subaperture_size_px"]
    focal_px = cfg["_focal_length_px"]
    wavelength_m = cfg["atmosphere"]["wavelength_m"]
    pitch_m = cfg["mla"]["pitch_mm"] * 1e-3
    cx_frame = cfg["pupil"]["centre_x_px"]
    cy_frame = cfg["pupil"]["centre_y_px"]
    r_pupil = cfg["pupil"]["diameter_px"] / 2

    # Phase screen: npix x npix, covering the pupil
    npix = phase_screen.shape[0]
    x_off = int(cx_frame - r_pupil)  # phase-screen origin in full frame
    y_off = int(cy_frame - r_pupil)

    # Gradient of phase in rad/pixel; physical pixel size = pitch_m / sub_px
    pixel_m = pitch_m / sub_px
    grad_y, grad_x = np.gradient(phase_screen)  # rad/pixel

    # centroid displacement [m] = (lambda/(2*pi)) * focal_length_m * (mean_grad [rad/m])
    # centroid displacement [px] = displacement_m / pixel_size_um * 1e6 ... or:
    # displacement_px = (lambda/(2*pi)) * mean_grad_rad_per_pixel * (focal_length_px / sub_px)
    # (mean_grad_rad_per_pixel ≈ mean slope over subaperture in rad/pixel of the phase screen)
    # focal_px / sub_px = f/d ratio in pixels
    scale = (wavelength_m / (2 * math.pi)) * (focal_px / (pixel_m * npix / (2 * r_pupil)))

    displacements = []
    for i in range(ny):
        for j in range(nx):
            x0 = int(cx_frame - (nx / 2 - j) * sub_px)
            y0 = int(cy_frame - (ny / 2 - i) * sub_px)
            sc_x = x0 + sub_px // 2 - cx_frame
            sc_y = y0 + sub_px // 2 - cy_frame
            if sc_x**2 + sc_y**2 >= r_pupil**2:
                continue
            # Convert to phase-screen coords
            px = x0 - x_off
            py = y0 - y_off
            px = max(0, min(px, npix - sub_px - 1))
            py = max(0, min(py, npix - sub_px - 1))
            dx = float(grad_x[py:py+sub_px, px:px+sub_px].mean()) * scale
            dy = float(grad_y[py:py+sub_px, px:px+sub_px].mean()) * scale
            displacements.append((dx, dy))

    return displacements


def generate_frame_from_screen(cfg, displacements, rng, n_photons=1000, read_noise_e=5.0):
    nx = cfg["mla"]["n_lenslets_x"]
    ny = cfg["mla"]["n_lenslets_y"]
    sub_px = cfg["_subaperture_size_px"]
    fw = cfg["camera"]["frame_width_px"]
    fh = cfg["camera"]["frame_height_px"]
    cx_frame = cfg["pupil"]["centre_x_px"]
    cy_frame = cfg["pupil"]["centre_y_px"]
    r_pupil = cfg["pupil"]["diameter_px"] / 2

    frame = np.zeros((fh, fw), dtype=np.float32)
    disp_idx = 0
    for i in range(ny):
        for j in range(nx):
            x0 = int(cx_frame - (nx / 2 - j) * sub_px)
            y0 = int(cy_frame - (ny / 2 - i) * sub_px)
            sc_x = x0 + sub_px // 2 - cx_frame
            sc_y = y0 + sub_px // 2 - cy_frame
            if sc_x**2 + sc_y**2 >= r_pupil**2:
                continue
            dx, dy = displacements[disp_idx]; disp_idx += 1
            spot_cx = sub_px / 2 + dx
            spot_cy = sub_px / 2 + dy
            patch = gaussian_psf(sub_px, sub_px, spot_cx, spot_cy, sigma=2.0)
            patch = rng.poisson(patch * n_photons).astype(np.float32) / n_photons
            patch += rng.normal(0, read_noise_e / n_photons, patch.shape).astype(np.float32)
            patch = np.clip(patch, 0, None)
            y1 = min(y0 + sub_px, fh)
            x1 = min(x0 + sub_px, fw)
            if y0 >= 0 and x0 >= 0:
                frame[y0:y1, x0:x1] += patch[:y1-y0, :x1-x0]
    return np.clip(frame, 0, 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/system.yaml")
    parser.add_argument("--n-frames", type=int, default=500)
    parser.add_argument("--r0-min", type=float, default=0.05)
    parser.add_argument("--r0-max", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    cfg = load_config(args.config)
    rng = np.random.default_rng(args.seed)

    raw_dir = ROOT / cfg["data"]["raw_frames_dir"]
    raw_dir.mkdir(parents=True, exist_ok=True)
    cal_dir = ROOT / "data/calibration"

    pupil_r = cfg["pupil"]["diameter_px"] / 2
    npix = int(2 * pupil_r)
    L0 = cfg["atmosphere"]["L0_m"]
    l0 = cfg["atmosphere"]["l0_m"]

    # Use telescope diameter in pixels as the physical scale
    # delta [m/pixel] such that the phase screen covers the pupil
    telescope_D_m = 0.5  # assumed 50 cm aperture
    delta = telescope_D_m / npix

    bit_max = 2**cfg["camera"]["bit_depth"] - 1
    r0_values = []

    print(f"Generating {args.n_frames} Kolmogorov frames...")
    for idx in range(args.n_frames):
        r0_m = rng.uniform(args.r0_min, args.r0_max)
        r0_values.append(r0_m)
        screen = aotools.turbulence.phasescreen.ft_phase_screen(
            r0_m, npix, delta, L0=L0, l0=l0
        ).astype(np.float32)
        disps = compute_subaperture_slopes(screen, cfg)
        frame = generate_frame_from_screen(cfg, disps, rng)
        frame_u16 = (frame * bit_max).astype(np.uint16)
        cv2.imwrite(str(raw_dir / f"frame_{idx:04d}.png"), frame_u16)
        if (idx + 1) % 100 == 0:
            print(f"  {idx+1}/{args.n_frames}  r0={r0_m:.3f}m")

    # Save ground-truth r0 values for benchmarking
    np.save(cal_dir / "ground_truth_r0.npy", np.array(r0_values, dtype=np.float32))
    print(f"Saved {args.n_frames} frames with Kolmogorov statistics")
    print(f"r0 range: {min(r0_values):.3f}–{max(r0_values):.3f} m")
    print(f"Ground-truth r0 saved: data/calibration/ground_truth_r0.npy")


if __name__ == "__main__":
    main()
