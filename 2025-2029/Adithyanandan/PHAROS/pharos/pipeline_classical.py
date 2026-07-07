"""End-to-end classical PHAROS pipeline — Stage 2 deliverable script."""

import argparse
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pharos.config import load_config
from pharos.preprocess import load_frame, preprocess
from pharos.centroid import build_subaperture_map, compute_centroids
from pharos.slopes import compute_slopes
from pharos.zernike import zernike_basis
from pharos.reconstruct import (
    build_zernike_interaction_matrix,
    build_reconstructor,
    reconstruct_wavefront,
)
from pharos.turbulence import estimate_r0_from_zernike, estimate_tau0


def main():
    parser = argparse.ArgumentParser(description="Classical PHAROS pipeline")
    parser.add_argument("--config", default="config/system.yaml")
    parser.add_argument("--n-modes", type=int, default=20)
    parser.add_argument("--n-frames", type=int, default=None)
    parser.add_argument("--output-dir", default="data/processed")
    args = parser.parse_args()

    cfg = load_config(args.config)
    out_dir = Path(ROOT / args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    dark = np.load(ROOT / cfg["data"]["dark_frame_path"])
    flat = np.load(ROOT / cfg["data"]["flat_frame_path"])
    ref_centroids = np.load(ROOT / cfg["data"]["reference_centroids_path"])

    subapertures = build_subaperture_map(cfg)
    pupil_radius_px = cfg["pupil"]["diameter_px"] / 2
    n_modes = args.n_modes

    print(f"Building interaction matrix ({n_modes} modes)...")
    D = build_zernike_interaction_matrix(subapertures, n_modes, pupil_radius_px)
    print(f"  D shape: {D.shape}")
    R = build_reconstructor(D, rcond=1e-3)
    basis = zernike_basis(n_modes, int(2 * pupil_radius_px))

    raw_dir = ROOT / cfg["data"]["raw_frames_dir"]
    frame_paths = sorted(raw_dir.glob("*.bmp")) + sorted(raw_dir.glob("*.png"))
    if args.n_frames:
        frame_paths = frame_paths[: args.n_frames]
    print(f"Processing {len(frame_paths)} frames...")

    coeffs_series = []
    slopes_series = []
    first_frame_raw = None
    first_phase = None

    for idx, fpath in enumerate(frame_paths):
        frame = load_frame(str(fpath), cfg["camera"]["bit_depth"])
        frame = preprocess(frame, dark, flat)
        if first_frame_raw is None:
            first_frame_raw = frame.copy()

        centroids = compute_centroids(frame, subapertures)
        s = compute_slopes(centroids, ref_centroids, cfg["_focal_length_px"])
        coeffs, phase_map = reconstruct_wavefront(s, R, basis)

        coeffs_series.append(coeffs)
        slopes_series.append(s)
        if first_phase is None:
            first_phase = phase_map.copy()
            np.save(out_dir / "phase_map_000.npy", phase_map)

        if (idx + 1) % 50 == 0:
            print(f"  {idx+1}/{len(frame_paths)}")

    coeffs_series = np.array(coeffs_series)
    slopes_series = np.array(slopes_series)

    wavelength_m = cfg["atmosphere"]["wavelength_m"]
    D_m = cfg["pupil"]["diameter_px"] * cfg["camera"]["pixel_size_um"] * 1e-6
    r0 = estimate_r0_from_zernike(coeffs_series, wavelength_m, D_m)
    tau0 = estimate_tau0(slopes_series, cfg["camera"]["frame_rate_hz"])

    print(f"\nEstimated r₀  = {r0 * 100:.2f} cm")
    if tau0 == tau0:  # not NaN
        print(f"Estimated τ₀  = {tau0 * 1000:.2f} ms")
    else:
        print("τ₀ = NaN (insufficient frames for PSD fit)")

    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    axes[0].imshow(first_frame_raw, cmap="gray", origin="upper")
    axes[0].set_title("Raw frame (preprocessed)")
    im = axes[1].imshow(first_phase, cmap="RdBu_r", origin="upper")
    axes[1].set_title("Reconstructed phase (rad)")
    plt.colorbar(im, ax=axes[1])
    for mode_idx in range(min(5, coeffs_series.shape[1])):
        axes[2].plot(coeffs_series[:, mode_idx], label=f"Z{mode_idx+2}", alpha=0.7)
    axes[2].set_xlabel("Frame")
    axes[2].set_ylabel("Coefficient (rad)")
    axes[2].set_title("Zernike coefficients over time")
    axes[2].legend(fontsize=7)
    fig.tight_layout()
    out_fig = out_dir / "pipeline_classical_output.png"
    fig.savefig(out_fig, dpi=120)
    print(f"Figure saved: {out_fig}")


if __name__ == "__main__":
    main()
