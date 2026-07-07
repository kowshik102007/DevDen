"""Generate synthetic SH-WFS data for development and testing without hardware."""

import argparse
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from pharos.config import load_config


def gaussian_psf(H: int, W: int, cx: float, cy: float, sigma: float = 2.0) -> np.ndarray:
    y, x = np.mgrid[:H, :W].astype(float)
    return np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma**2))


def generate_frame(cfg: dict, rng: np.random.Generator,
                   turbulence_strength: float = 1.5) -> np.ndarray:
    nx = cfg["mla"]["n_lenslets_x"]
    ny = cfg["mla"]["n_lenslets_y"]
    sub_px = cfg["_subaperture_size_px"]
    fw = cfg["camera"]["frame_width_px"]
    fh = cfg["camera"]["frame_height_px"]
    cx_frame = cfg["pupil"]["centre_x_px"]
    cy_frame = cfg["pupil"]["centre_y_px"]
    r_pupil = cfg["pupil"]["diameter_px"] / 2

    frame = np.zeros((fh, fw), dtype=np.float32)

    for i in range(ny):
        for j in range(nx):
            x0 = int(cx_frame - (nx / 2 - j) * sub_px)
            y0 = int(cy_frame - (ny / 2 - i) * sub_px)
            sc_x = x0 + sub_px // 2 - cx_frame
            sc_y = y0 + sub_px // 2 - cy_frame
            if sc_x**2 + sc_y**2 >= r_pupil**2:
                continue
            # Spot centre with random turbulence displacement
            dx = rng.uniform(-turbulence_strength, turbulence_strength)
            dy = rng.uniform(-turbulence_strength, turbulence_strength)
            spot_cx = sub_px / 2 + dx
            spot_cy = sub_px / 2 + dy
            patch = gaussian_psf(sub_px, sub_px, spot_cx, spot_cy, sigma=2.0)
            # Poisson noise (~1000 photons peak)
            patch = rng.poisson(patch * 1000).astype(np.float32) / 1000.0
            # Read noise (~5e-)
            patch += rng.normal(0, 5.0 / 1000.0, patch.shape).astype(np.float32)
            patch = np.clip(patch, 0, None)
            y1 = min(y0 + sub_px, fh)
            x1 = min(x0 + sub_px, fw)
            if y0 >= 0 and x0 >= 0:
                frame[y0:y1, x0:x1] += patch[:y1-y0, :x1-x0]

    return np.clip(frame, 0, 1)


def generate_reference_centroids(cfg: dict) -> np.ndarray:
    """Geometric reference centroids for a flat wavefront."""
    nx = cfg["mla"]["n_lenslets_x"]
    ny = cfg["mla"]["n_lenslets_y"]
    sub_px = cfg["_subaperture_size_px"]
    cx_frame = cfg["pupil"]["centre_x_px"]
    cy_frame = cfg["pupil"]["centre_y_px"]
    r_pupil = cfg["pupil"]["diameter_px"] / 2

    centroids = []
    for i in range(ny):
        for j in range(nx):
            x0 = int(cx_frame - (nx / 2 - j) * sub_px)
            y0 = int(cy_frame - (ny / 2 - i) * sub_px)
            sc_x = x0 + sub_px // 2 - cx_frame
            sc_y = y0 + sub_px // 2 - cy_frame
            if sc_x**2 + sc_y**2 >= r_pupil**2:
                continue
            centroids.append([x0 + sub_px / 2, y0 + sub_px / 2])
    return np.array(centroids, dtype=np.float32)


def generate_synthetic_coupling_matrix(cfg: dict) -> np.ndarray:
    """Gaussian influence function per actuator — stands in for lab-measured matrix."""
    n_act = cfg["dm"]["n_actuators"]
    n_side = int(np.ceil(np.sqrt(n_act)))
    sub_px = cfg["_subaperture_size_px"]
    nx = cfg["mla"]["n_lenslets_x"]
    ny = cfg["mla"]["n_lenslets_y"]
    cx_frame = cfg["pupil"]["centre_x_px"]
    cy_frame = cfg["pupil"]["centre_y_px"]
    r_pupil = cfg["pupil"]["diameter_px"] / 2

    phase_pts = []
    for i in range(ny):
        for j in range(nx):
            x0 = int(cx_frame - (nx / 2 - j) * sub_px)
            y0 = int(cy_frame - (ny / 2 - i) * sub_px)
            sc_x = x0 + sub_px // 2 - cx_frame
            sc_y = y0 + sub_px // 2 - cy_frame
            if sc_x**2 + sc_y**2 < r_pupil**2:
                phase_pts.append([x0 + sub_px / 2, y0 + sub_px / 2])
    phase_pts = np.array(phase_pts)

    actuator_pitch_px = sub_px * nx / n_side
    act_positions = []
    for i in range(n_side):
        for j in range(n_side):
            ax = cx_frame - (n_side / 2 - j) * actuator_pitch_px
            ay = cy_frame - (n_side / 2 - i) * actuator_pitch_px
            act_positions.append([ax, ay])
    act_positions = np.array(act_positions[:n_act])

    sigma = actuator_pitch_px * 1.2
    I = np.zeros((len(phase_pts), n_act), dtype=np.float32)
    for k, (ax, ay) in enumerate(act_positions):
        d2 = (phase_pts[:, 0] - ax) ** 2 + (phase_pts[:, 1] - ay) ** 2
        I[:, k] = np.exp(-d2 / (2 * sigma**2))
    return I


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic PHAROS data")
    parser.add_argument("--config", default="config/system.yaml")
    parser.add_argument("--n-frames", type=int, default=200)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    cfg = load_config(args.config)
    rng = np.random.default_rng(args.seed)

    raw_dir = Path(ROOT / cfg["data"]["raw_frames_dir"])
    cal_dir = Path(ROOT / "data/calibration")
    raw_dir.mkdir(parents=True, exist_ok=True)
    cal_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {args.n_frames} synthetic frames...")
    bit_max = 2 ** cfg["camera"]["bit_depth"] - 1
    for idx in range(args.n_frames):
        frame = generate_frame(cfg, rng)
        import cv2
        frame_u16 = (frame * bit_max).astype(np.uint16)
        # cv2 does not support 16-bit BMP; use PNG which preserves full bit depth
        cv2.imwrite(str(raw_dir / f"frame_{idx:04d}.png"), frame_u16)
        if (idx + 1) % 50 == 0:
            print(f"  {idx+1}/{args.n_frames}")

    print("Generating calibration files...")
    dark = np.zeros((cfg["camera"]["frame_height_px"], cfg["camera"]["frame_width_px"]),
                    dtype=np.float32) + 0.002
    np.save(cal_dir / "dark.npy", dark)

    flat = np.ones((cfg["camera"]["frame_height_px"], cfg["camera"]["frame_width_px"]),
                   dtype=np.float32)
    np.save(cal_dir / "flat.npy", flat)

    ref_centroids = generate_reference_centroids(cfg)
    np.save(cal_dir / "ref_centroids.npy", ref_centroids)
    print(f"  Reference centroids: {ref_centroids.shape}")

    coupling = generate_synthetic_coupling_matrix(cfg)
    np.save(cal_dir / "coupling_matrix.npy", coupling)
    print(f"  Coupling matrix: {coupling.shape}")

    print("Done. Synthetic data written to data/raw/ and data/calibration/")


if __name__ == "__main__":
    main()
