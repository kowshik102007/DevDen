# PHAROS

**Phase and Hartmann Adaptive Reconstruction with Optimised Sensing**

A Python pipeline for wavefront reconstruction and atmospheric turbulence characterisation using Shack-Hartmann Wavefront Sensor (SH-WFS) data, with classical and ML-accelerated paths.

---

## Overview

PHAROS implements the full adaptive optics processing chain:

```
Raw frame → Preprocess → Centroid → Slopes → Reconstruct → Turbulence → DM Commands
```

It includes three trained ML models as drop-in replacements for classical stages, a real-time control loop (Stage 6), and a benchmarking suite.

---

## Project Structure

```
pharos/                        Core pipeline modules
  preprocess.py                Dark subtraction + flat correction
  centroid.py                  CoM / threshold-CoM / Gaussian centroiders (+ vectorised batch)
  slopes.py                    Centroid offsets → x/y wavefront slopes
  zernike.py                   Zernike polynomial basis (via aotools)
  reconstruct.py               SVD interaction matrix + pseudoinverse reconstructor
  turbulence.py                Fried parameter r₀ (Noll 1976) + coherence time τ₀
  actuator.py                  Least-squares DM actuator command solver
  pipeline_classical.py        End-to-end classical pipeline
  realtime.py                  Producer-consumer real-time control loop

ml/
  centroid_cnn/                CentroidCNN — patch → sub-pixel centroid
  reconstructor/               WavefrontMLP — slope vector → Zernike coefficients
  turbulence_ann/              TurbulenceANN — Zernike variances → r₀, τ₀
  rl_control/                  PPO environment + training for DM control

export/                        TorchScript model export
benchmarks/                    Latency and accuracy benchmarks (Stage 5)
data/
  raw/                         SH-WFS frames (PNG, uint16)
  calibration/                 dark.npy, flat.npy, ref_centroids.npy, coupling_matrix.npy
  sim/                         Dataset generators (Kolmogorov + synthetic PSF)
tests/                         pytest suite
simulate_loop.py               Stage 6 — 1000-frame closed-loop simulation
config/system.yaml             Full system configuration
```

---

## Requirements

```
numpy scipy opencv-python matplotlib astropy
ruamel.yaml tqdm aotools
torch torchvision onnx
stable-baselines3 gymnasium
```

Install:

```bash
pip install -r requirements.txt
pip install -e .
```

> **Note:** aotools requires NumPy ≤ 2.4 for its numba-dependent modules. On NumPy 2.5+, the pipeline applies a numba stub automatically — core functionality is unaffected.

---

## Quick Start

### 1. Generate synthetic data

```bash
python data/sim/generate_sim_data.py          # calibration frames + PSF spots
python data/sim/generate_kolmogorov_data.py   # Kolmogorov turbulence frames (500 frames, r₀ 5–25 cm)
```

### 2. Run the classical pipeline

```bash
python pharos/pipeline_classical.py
```

### 3. Train all ML models

```bash
python ml/reconstructor/dataset.py --generate --n-samples 10000
python ml/turbulence_ann/dataset.py --generate --n-samples 50000
python ml/train_all.py
```

### 4. Export models

```bash
python export/export_models.py
```

### 5. Stage 6 — simulated closed loop

```bash
python simulate_loop.py --n-frames 1000 --mode classical
python simulate_loop.py --n-frames 1000 --mode ml
```

### 6. Benchmark (Stage 5)

```bash
python benchmarks/benchmark.py --n-frames 200
```

---

## Performance

Measured on CPU-only (Python 3.14, NumPy 2.5, PyTorch 2.14):

| Pipeline | Median | p95 | r₀ estimate |
|---|---|---|---|
| Classical (SVD) | **6.6 ms** | 10.8 ms | 1.30 cm |
| ML (WavefrontMLP) | 19.6 ms | 24.8 ms | — |

Key optimisations over the naive baseline (58 ms → 6.6 ms):
- `preprocess_fast` with precomputed flat corrector
- `compute_centroids_vectorised` (batched NumPy, no per-subaperture Python loop)
- `basis_at_pts @ coeffs` — phase at sample points only, skipping the full 900×900 phase map

---

## Tests

```bash
pytest tests/ -v
```

12 tests passing, 2 skipped (Zernike round-trip tests require aotools with numba ≤ 2.4).

---

## Configuration

All system parameters live in `config/system.yaml`:

```yaml
mla:
  n_lenslets_x: 10
  n_lenslets_y: 10
  pitch_mm: 0.3
  focal_length_mm: 18.6

camera:
  pixel_size_um: 5.5
  frame_width_px: 1024
  frame_height_px: 1024
  frame_rate_hz: 200.0

pupil:
  diameter_px: 900
  centre_x_px: 512
  centre_y_px: 512

dm:
  n_actuators: 97
  stroke_um: 5.0
```

---

## Real Data Sources

To replace synthetic frames with real SH-WFS measurements:

- **ESO Archive** — SPHERE/SAXO and MUSE/GALACSI WFS telemetry
- **CANARY test bench** (University of Durham) — open-access SH-WFS datasets
- **COMPASS simulator** — Python AO simulator with calibrated SH-WFS output and paired r₀/Cn² labels

---

## License

MIT
