# PHAROS
## Phase and Hartmann Adaptive Reconstruction with Optimised Sensing

> End-to-end Python + ML/DL pipeline for wavefront reconstruction and turbulence characterisation using Shack-Hartmann Wavefront Sensor (SH-WFS) time-series data.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Repository structure](#2-repository-structure)
3. [Stage 1 — Environment & data familiarisation](#3-stage-1--environment--data-familiarisation)
4. [Stage 2 — Classical baseline pipeline](#4-stage-2--classical-baseline-pipeline)
5. [Stage 3 — ML/DL model design & training](#5-stage-3--mldl-model-design--training)
6. [Stage 4 — Actuator map & DM control](#6-stage-4--actuator-map--dm-control)
7. [Stage 5 — Validation & benchmarking](#7-stage-5--validation--benchmarking)
8. [Stage 6 — Real-time integration & optimisation](#8-stage-6--real-time-integration--optimisation)
9. [Python stack reference](#9-python-stack-reference)
10. [Key concepts & formulae](#10-key-concepts--formulae)
11. [Research reading list](#11-research-reading-list)
12. [Glossary](#12-glossary)

---

## 1. Project overview

### The physics problem

Atmospheric turbulence causes random, time-varying refractive index fluctuations along the optical path. A plane-parallel wavefront entering the atmosphere exits as a distorted wavefront whose phase varies spatially. This phase distortion must be measured and corrected faster than the atmosphere changes — typically on a timescale of milliseconds (the coherence time τ₀).

### The sensor

A Shack-Hartmann Wavefront Sensor (SH-WFS) places a Microlens Array (MLA) in the pupil plane. Each lenslet focuses its portion of the wavefront onto a camera, creating a grid of spots. A flat wavefront produces a regular reference grid. A distorted wavefront shifts each spot from its reference position. The displacement of each spot encodes the local slope (gradient) of the wavefront at that sub-aperture.

### What PHAROS does

PHAROS takes a time-series of SH-WFS camera frames and produces:

- Reconstructed wavefront phase maps `W(xi, yi)` for each frame
- Turbulence characterisation: Fried parameter `r₀` and coherence time `τ₀`
- Deformable mirror (DM) actuator maps `A(xi, yi)` to correct the distortion in real time

Classical algorithms provide a working baseline. ML/DL models replace or augment the bottleneck stages (centroiding and reconstruction) for improved accuracy at low SNR and noise robustness.

### Evaluation criteria

| Criterion | Target |
|---|---|
| Wavefront reconstruction accuracy | RMS error consistent with Kolmogorov turbulence statistics |
| Turbulence parameters | r₀ and τ₀ within accepted uncertainty bounds |
| End-to-end loop latency | < 10 ms per frame |
| Computational efficiency | Vectorised NumPy + GPU inference via TorchScript / ONNX |

---

## 2. Repository structure

```
pharos/
├── config/
│   └── system.yaml          # All optical, detector, and DM parameters
├── data/
│   ├── raw/                 # Input .bmp frame time-series
│   ├── calibration/         # Dark frames, flat fields, reference centroids
│   └── processed/           # Numpy arrays after preprocessing
├── pharos/
│   ├── __init__.py
│   ├── config.py            # Config loader
│   ├── preprocess.py        # Frame loading, dark sub, flat field
│   ├── centroid.py          # Classical centroiding algorithms
│   ├── slopes.py            # Slope vector assembly
│   ├── reconstruct.py       # Classical wavefront reconstruction
│   ├── zernike.py           # Zernike polynomial utilities
│   ├── turbulence.py        # r₀ and τ₀ estimation
│   ├── actuator.py          # Coupling matrix solver and actuator maps
│   └── realtime.py          # Real-time loop orchestrator
├── ml/
│   ├── centroid_cnn/
│   │   ├── model.py         # CNN architecture
│   │   ├── dataset.py       # Synthetic data generator
│   │   └── train.py         # Training loop
│   ├── reconstructor/
│   │   ├── model.py         # MLP / Transformer architecture
│   │   ├── dataset.py       # Slope vector dataset
│   │   └── train.py         # Training loop
│   ├── turbulence_ann/
│   │   ├── model.py         # Regression ANN for r₀, τ₀
│   │   └── train.py
│   └── rl_control/
│       ├── env.py           # Gym-compatible AO closed-loop environment
│       └── train.py         # PPO training via Stable-Baselines3
├── export/
│   └── export_models.py     # PyTorch → TorchScript / ONNX
├── benchmarks/
│   └── benchmark.py         # End-to-end latency and accuracy profiling
├── notebooks/
│   └── exploration.ipynb    # Interactive analysis and visualisation
├── tests/
│   └── test_*.py
├── requirements.txt
└── README.md
```

---

## 3. Stage 1 — Environment & data familiarisation

### Goal

Before writing any code, gather all system parameters and understand the dataset. Every downstream algorithm depends on these numbers being correct.

### Environment setup

```bash
# Create and activate a virtual environment
python -m venv pharos-env
source pharos-env/bin/activate   # Windows: pharos-env\Scripts\activate

# Install core dependencies
pip install numpy scipy matplotlib opencv-python astropy pyyaml tqdm

# ML dependencies
pip install torch torchvision onnx onnxruntime
pip install stable-baselines3 gymnasium

# Optional GPU acceleration
pip install cupy-cuda12x   # match your CUDA version
```

### Research questions to answer before proceeding

**About the MLA:**
- What is the lenslet pitch (centre-to-centre spacing in mm)?
- What is the lenslet focal length?
- How many lenslets are there across the pupil (N × N grid)?
- Are any sub-apertures vignetted at the pupil edge, and how are they handled?

**About the camera:**
- What is the pixel size (µm)?
- What is the full frame resolution (pixels × pixels)?
- What is the frame rate (Hz) and exposure time?
- What bit depth are the .bmp files (8-bit, 12-bit, 16-bit)?

**About the DM:**
- How many actuators, and what is their grid layout?
- What is the actuator stroke range (µm)?
- In what format is the influence / coupling matrix provided?
- What is the hardware interface (USB, PCIe, Ethernet) and what Python SDK drives it?

**About the data:**
- Are dark frames provided, or must you collect them?
- Are flat-field frames provided?
- What is the reference centroid grid (measured with a flat wavefront, or computed from geometry)?
- What is the total number of frames in the time-series, and over what duration?

### Config file

Create `config/system.yaml` immediately with every parameter you find:

```yaml
mla:
  n_lenslets_x: 10          # number of lenslets across x
  n_lenslets_y: 10
  pitch_mm: 0.3             # lenslet pitch in millimetres
  focal_length_mm: 18.6     # lenslet focal length

camera:
  pixel_size_um: 5.5        # pixel size in micrometres
  frame_width_px: 1024
  frame_height_px: 1024
  bit_depth: 16
  frame_rate_hz: 200.0

pupil:
  diameter_px: 900          # pupil diameter on detector in pixels
  centre_x_px: 512
  centre_y_px: 512

dm:
  n_actuators: 97
  stroke_um: 5.0
  coupling_matrix_path: "data/calibration/coupling_matrix.npy"

data:
  raw_frames_dir: "data/raw/"
  dark_frame_path: "data/calibration/dark.npy"
  flat_frame_path: "data/calibration/flat.npy"
  reference_centroids_path: "data/calibration/ref_centroids.npy"
```

### Stage 1 deliverable

A completed `system.yaml` with every field filled in from the provided dataset documentation. A short `notebooks/exploration.ipynb` that loads one frame, displays it, and overlays the expected sub-aperture grid.

---

## 4. Stage 2 — Classical baseline pipeline

### Goal

A complete, correct, slow pipeline. Every stage must produce physically sensible output before the next stage is implemented. Do not optimise yet.

### Research questions to answer

- How does sigma-clipping threshold selection work for centroiding, and when does it fail?
- What is the Fried geometry exactly, and how does it constrain the relationship between the lenslet grid and the DM actuator grid?
- How are Zernike polynomials indexed (Noll convention vs ANSI)? Which convention does your reconstructor use?
- How is the interaction matrix D built from the Zernike basis and the MLA geometry?
- What singular value threshold should be used when truncating the SVD of D to form the pseudo-inverse reconstructor R?
- How do you convert Zernike coefficient variances to r₀ using the Noll (1976) formula?
- What is the temporal power spectral density of Zernike coefficients under frozen-flow turbulence, and how do you fit τ₀ from it?

### 2.1 Frame preprocessing

```python
# pharos/preprocess.py

import numpy as np
import cv2

def load_frame(path: str, bit_depth: int = 16) -> np.ndarray:
    """Load a .bmp frame and normalise to float32 [0, 1]."""
    frame = cv2.imread(path, cv2.IMREAD_UNCHANGED).astype(np.float32)
    frame /= (2**bit_depth - 1)
    return frame

def dark_subtract(frame: np.ndarray, dark: np.ndarray) -> np.ndarray:
    return np.clip(frame - dark, 0, None)

def flat_correct(frame: np.ndarray, flat: np.ndarray) -> np.ndarray:
    flat_norm = flat / flat.mean()
    return frame / np.where(flat_norm > 0.1, flat_norm, 1.0)

def preprocess(frame: np.ndarray, dark: np.ndarray, flat: np.ndarray) -> np.ndarray:
    frame = dark_subtract(frame, dark)
    frame = flat_correct(frame, flat)
    return frame
```

### 2.2 Sub-aperture ROI mapping

Before centroiding, you need to know which pixel region belongs to each lenslet. Build this map once from geometry:

```python
# pharos/centroid.py  (ROI section)

import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class SubAperture:
    index: Tuple[int, int]   # (row, col) in lenslet grid
    x0: int                  # left pixel
    y0: int                  # top pixel
    width: int
    height: int
    active: bool             # False if vignetted by pupil

def build_subaperture_map(config: dict) -> List[SubAperture]:
    """
    Compute pixel ROIs for each sub-aperture from MLA geometry.
    Research: how do you determine which lenslets fall within the pupil?
    """
    nx = config['mla']['n_lenslets_x']
    ny = config['mla']['n_lenslets_y']
    pitch_px = config['mla']['pitch_mm'] / config['camera']['pixel_size_um'] * 1000
    sub_size = int(pitch_px)

    cx = config['pupil']['centre_x_px']
    cy = config['pupil']['centre_y_px']
    r_pupil = config['pupil']['diameter_px'] / 2

    subapertures = []
    for i in range(ny):
        for j in range(nx):
            x0 = int(cx - (nx / 2 - j) * sub_size)
            y0 = int(cy - (ny / 2 - i) * sub_size)
            # Check if sub-aperture centre is within pupil
            sc_x = x0 + sub_size // 2 - cx
            sc_y = y0 + sub_size // 2 - cy
            active = (sc_x**2 + sc_y**2) < r_pupil**2
            subapertures.append(SubAperture(
                index=(i, j), x0=x0, y0=y0,
                width=sub_size, height=sub_size, active=active
            ))
    return subapertures
```

### 2.3 Centroiding

Three algorithms in increasing accuracy order. Start with CoM, validate, then add threshold CoM:

```python
def centroid_com(patch: np.ndarray) -> Tuple[float, float]:
    """Centre of mass — fast but noise-sensitive."""
    y_idx, x_idx = np.indices(patch.shape)
    total = patch.sum()
    if total == 0:
        return patch.shape[1] / 2, patch.shape[0] / 2
    cx = (x_idx * patch).sum() / total
    cy = (y_idx * patch).sum() / total
    return cx, cy

def centroid_threshold_com(patch: np.ndarray, sigma: float = 3.0) -> Tuple[float, float]:
    """
    Threshold at mean + sigma * std, then CoM.
    Research: what sigma value minimises centroid noise for your spot SNR?
    """
    threshold = patch.mean() + sigma * patch.std()
    patch_t = np.where(patch > threshold, patch - threshold, 0.0)
    return centroid_com(patch_t)

def centroid_gaussian_2d(patch: np.ndarray) -> Tuple[float, float]:
    """
    Fit a 2D Gaussian — most accurate, ~10x slower.
    Use scipy.optimize.curve_fit.
    Research: when does the Gaussian fit diverge on aberrated spots?
    """
    from scipy.optimize import curve_fit
    # ... implementation left as research exercise
    pass

def compute_centroids(frame: np.ndarray,
                      subapertures: List[SubAperture],
                      method: str = 'threshold_com',
                      sigma: float = 3.0) -> np.ndarray:
    """
    Returns array of shape (N_active, 2) with (cx, cy) per sub-aperture.
    """
    centroids = []
    for sa in subapertures:
        if not sa.active:
            continue
        patch = frame[sa.y0:sa.y0+sa.height, sa.x0:sa.x0+sa.width]
        if method == 'threshold_com':
            cx, cy = centroid_threshold_com(patch, sigma)
        else:
            cx, cy = centroid_com(patch)
        centroids.append([cx + sa.x0, cy + sa.y0])  # global coords
    return np.array(centroids)
```

### 2.4 Slope vector assembly

```python
# pharos/slopes.py

import numpy as np

def compute_slopes(centroids: np.ndarray,
                   reference_centroids: np.ndarray,
                   focal_length_px: float) -> np.ndarray:
    """
    Slope = centroid deviation / focal length (in radians).
    Returns slope vector s of shape (2*N_active,): [sx_0..sx_n, sy_0..sy_n]

    Research: why is normalising by focal length important for the
    reconstructor matrix units to be consistent?
    """
    deviations = centroids - reference_centroids   # (N, 2)
    slopes = deviations / focal_length_px          # convert pixels to radians
    # Flatten: all x-slopes first, then all y-slopes
    s = np.concatenate([slopes[:, 0], slopes[:, 1]])
    return s
```

### 2.5 Wavefront reconstruction

```python
# pharos/reconstruct.py

import numpy as np
from scipy.linalg import lstsq

def build_zernike_interaction_matrix(subapertures, n_modes: int,
                                     pupil_radius_px: float) -> np.ndarray:
    """
    Build D matrix of shape (2*N_active, n_modes).
    Each column is the slope response of the wavefront to unit amplitude
    of the corresponding Zernike mode.

    Research:
    - Noll (1976) ordering vs ANSI ordering — which are you using?
    - Fried geometry: how does the lenslet grid relate to Zernike basis sampling?
    - How do you compute the x and y partial derivatives of each Zernike mode
      analytically at each sub-aperture centre?
    """
    # Placeholder — implementation requires Zernike derivative formulae
    # See pharos/zernike.py for the full Zernike basis implementation
    raise NotImplementedError("Build this after studying Noll 1976 and Fried 1977")

def build_reconstructor(D: np.ndarray, n_modes: int,
                         rcond: float = 1e-3) -> np.ndarray:
    """
    Pseudo-inverse reconstructor R = D⁺ via truncated SVD.
    R has shape (n_modes, 2*N_active).

    Research: what rcond (singular value threshold) to use?
    Too small → noise amplification. Too large → mode truncation.
    Inspect the singular value spectrum of D first.
    """
    U, s, Vt = np.linalg.svd(D, full_matrices=False)
    s_inv = np.where(s > rcond * s.max(), 1.0 / s, 0.0)
    R = Vt.T @ np.diag(s_inv) @ U.T
    return R

def reconstruct_wavefront(s: np.ndarray, R: np.ndarray,
                           zernike_basis: np.ndarray) -> tuple:
    """
    s: slope vector (2*N_active,)
    R: reconstructor matrix (n_modes, 2*N_active)
    zernike_basis: array (n_modes, H, W) — Zernike modes on pupil grid

    Returns:
        coeffs: Zernike coefficient vector (n_modes,)
        phase_map: reconstructed phase on pupil grid (H, W) in radians
    """
    coeffs = R @ s                              # (n_modes,)
    phase_map = np.tensordot(coeffs, zernike_basis, axes=([0], [0]))  # (H, W)
    return coeffs, phase_map
```

### 2.6 Turbulence characterisation

```python
# pharos/turbulence.py

import numpy as np
from scipy.signal import welch

def estimate_r0_from_zernike(coeffs_series: np.ndarray,
                              wavelength_m: float,
                              D_m: float) -> float:
    """
    Estimate Fried parameter r₀ from variance of Zernike coefficients.
    Uses Noll (1976) formula: Var(Z_j) = 0.2944 * (D/r₀)^(5/3) * noll_coeff(j)

    coeffs_series: shape (N_frames, n_modes) — time series of Zernike coefficients
    wavelength_m: observing wavelength in metres
    D_m: pupil diameter in metres

    Research:
    - Noll (1976) Table 1 — what are the variance coefficients for each mode?
    - Should tip and tilt (Z2, Z3) be included or excluded? Why?
    - How many modes give the most stable r₀ estimate?
    """
    # Noll coefficients (partial list — extend from Table 1 of Noll 1976)
    noll_coeff = {
        2: 0.448, 3: 0.448, 4: 0.023, 5: 0.023,
        6: 0.0062, 7: 0.0062, 8: 0.0023, 9: 0.0023, 10: 0.0023
    }
    variances = np.var(coeffs_series, axis=0)
    r0_estimates = []
    for j, coeff in noll_coeff.items():
        if j - 1 < len(variances) and coeff > 0:
            ratio = variances[j-1] / (0.2944 * coeff * wavelength_m**2)
            r0 = D_m * ratio**(-3/5)
            r0_estimates.append(r0)
    return float(np.median(r0_estimates))

def estimate_tau0(slopes_series: np.ndarray, frame_rate_hz: float) -> float:
    """
    Estimate coherence time τ₀ from temporal PSD of slope measurements.
    Frozen-flow turbulence produces f^(-8/3) PSD slope.
    Fit the knee frequency f₀ → τ₀ = 0.314 * r₀ / v_wind (or from f₀ directly).

    Research:
    - How do you robustly fit a power law to a noisy PSD?
    - What frequency range is reliable given your frame rate and number of frames?
    - How does averaging over multiple sub-apertures improve the τ₀ estimate?
    """
    freqs, psd = welch(slopes_series[:, 0], fs=frame_rate_hz, nperseg=256)
    # Research: fit f^(-8/3) slope and extract knee frequency
    # Placeholder — implement power law fitting here
    tau0 = None  # Replace with fitted value
    return tau0
```

### Stage 2 deliverable

A script `pharos/pipeline_classical.py` that processes the full frame time-series and outputs:
- Reconstructed phase maps saved as `.npy` files
- Printed r₀ and τ₀ estimates
- A Matplotlib figure showing: one raw frame, one phase map, and the Zernike coefficient time-series

---

## 5. Stage 3 — ML/DL model design & training

### Goal

Train models to replace the two classical bottlenecks: centroiding and wavefront reconstruction. Both must be benchmarked against the classical baseline before being trusted.

### Research questions to answer

- What CNN architectures have been used for SH-WFS centroiding? (Search: "convolutional neural network Shack-Hartmann centroiding", SPIE proceedings)
- How do you simulate realistic sub-aperture patches with Kolmogorov turbulence PSFs, photon noise, and read noise for training data generation?
- What is the domain gap problem in adaptive optics ML, and how is it mitigated (fine-tuning on real data, data augmentation, physics-informed losses)?
- For wavefront reconstruction: MLP vs CNN over the full slope map vs Transformer — what determines the best choice?
- How do you export a PyTorch model to TorchScript for C++-free fast inference in the real-time loop?

### 3.1 CNN centroid model

```python
# ml/centroid_cnn/model.py

import torch
import torch.nn as nn

class CentroidCNN(nn.Module):
    """
    Input: sub-aperture patch, shape (1, H, W) normalised float
    Output: spot displacement (Δx, Δy) in pixels relative to patch centre

    Research: what patch size H×W works best for your sub-aperture size?
    Should the model predict absolute position or deviation from patch centre?
    """
    def __init__(self, patch_size: int = 32):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 64, kernel_size=3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 64, kernel_size=3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
        )
        feat_size = (patch_size // 4) ** 2 * 64
        self.regressor = nn.Sequential(
            nn.Flatten(),
            nn.Linear(feat_size, 128), nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 2),   # (Δx, Δy)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.regressor(self.features(x))
```

```python
# ml/centroid_cnn/dataset.py

import numpy as np
import torch
from torch.utils.data import Dataset

class SyntheticSpotDataset(Dataset):
    """
    Generate synthetic sub-aperture patches with known spot positions.

    Research to implement:
    1. Simulate an Airy disk or diffraction-limited PSF for the lenslet
    2. Apply random sub-pixel displacement (Δx, Δy) drawn from turbulence statistics
    3. Add Poisson photon noise: patch = Poisson(patch * n_photons) / n_photons
    4. Add Gaussian read noise: patch += N(0, read_noise_e / n_photons)
    5. Consider adding aberrated spots (Zernike-distorted PSF) for robustness
    """
    def __init__(self, n_samples: int, patch_size: int,
                 max_displacement_px: float = 3.0,
                 n_photons: int = 1000, read_noise_e: float = 5.0):
        self.n_samples = n_samples
        self.patch_size = patch_size
        self.max_disp = max_displacement_px
        self.n_photons = n_photons
        self.read_noise = read_noise_e

    def __len__(self):
        return self.n_samples

    def __getitem__(self, idx):
        dx = np.random.uniform(-self.max_disp, self.max_disp)
        dy = np.random.uniform(-self.max_disp, self.max_disp)
        patch = self._simulate_spot(dx, dy)
        return torch.tensor(patch[None], dtype=torch.float32), \
               torch.tensor([dx, dy], dtype=torch.float32)

    def _simulate_spot(self, dx: float, dy: float) -> np.ndarray:
        # Research: implement Airy disk or Gaussian PSF simulation here
        H = W = self.patch_size
        y, x = np.mgrid[:H, :W].astype(float)
        cx, cy = W / 2 + dx, H / 2 + dy
        sigma = 2.0  # Research: estimate from lenslet f/# and pixel size
        patch = np.exp(-((x - cx)**2 + (y - cy)**2) / (2 * sigma**2))
        patch = np.random.poisson(patch * self.n_photons).astype(float) / self.n_photons
        patch += np.random.normal(0, self.read_noise / self.n_photons, patch.shape)
        return patch.astype(np.float32)
```

```python
# ml/centroid_cnn/train.py

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from ml.centroid_cnn.model import CentroidCNN
from ml.centroid_cnn.dataset import SyntheticSpotDataset

def train_centroid_cnn(patch_size: int = 32, n_epochs: int = 50,
                        lr: float = 1e-3, save_path: str = "ml/centroid_cnn/model.pt"):
    dataset = SyntheticSpotDataset(n_samples=50000, patch_size=patch_size)
    n_val = int(0.1 * len(dataset))
    train_ds, val_ds = random_split(dataset, [len(dataset) - n_val, n_val])
    train_dl = DataLoader(train_ds, batch_size=256, shuffle=True, num_workers=4)
    val_dl = DataLoader(val_ds, batch_size=256)

    model = CentroidCNN(patch_size=patch_size)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)
    optimiser = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()

    for epoch in range(n_epochs):
        model.train()
        train_loss = 0.0
        for patches, targets in train_dl:
            patches, targets = patches.to(device), targets.to(device)
            optimiser.zero_grad()
            preds = model(patches)
            loss = criterion(preds, targets)
            loss.backward()
            optimiser.step()
            train_loss += loss.item()

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for patches, targets in val_dl:
                patches, targets = patches.to(device), targets.to(device)
                val_loss += criterion(model(patches), targets).item()

        print(f"Epoch {epoch+1:3d} | train={train_loss/len(train_dl):.4f} "
              f"| val={val_loss/len(val_dl):.4f}")

    torch.save(model.state_dict(), save_path)
    print(f"Saved to {save_path}")
```

### 3.2 DL wavefront reconstructor

```python
# ml/reconstructor/model.py

import torch
import torch.nn as nn

class WavefrontMLP(nn.Module):
    """
    Input: slope vector s, shape (2 * N_active,)
    Output: Zernike coefficient vector, shape (n_modes,)

    Research:
    - Is a plain MLP sufficient, or does a CNN over the 2D slope map help?
    - What n_modes is appropriate (typically 20–100 for AO systems)?
    - Dropout rate — how much regularisation is needed?
    """
    def __init__(self, n_slopes: int, n_modes: int, hidden: int = 512):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_slopes, hidden), nn.LayerNorm(hidden), nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(hidden, hidden), nn.LayerNorm(hidden), nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(hidden, n_modes),
        )

    def forward(self, s: torch.Tensor) -> torch.Tensor:
        return self.net(s)
```

### 3.3 Turbulence ANN

```python
# ml/turbulence_ann/model.py

import torch
import torch.nn as nn

class TurbulenceANN(nn.Module):
    """
    Input: time-series of Zernike coefficients, shape (T, n_modes)
           or their summary statistics (variances, temporal correlations)
    Output: [r₀, τ₀] — scalar estimates

    Research: is a simple regression on variances sufficient,
    or does a 1D CNN / LSTM over the time-series improve τ₀ estimation?
    """
    def __init__(self, n_features: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_features, 128), nn.ReLU(),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, 2),   # [r₀, τ₀]
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)
```

### 3.4 Model export for inference

```python
# export/export_models.py

import torch
from ml.centroid_cnn.model import CentroidCNN
from ml.reconstructor.model import WavefrontMLP

def export_to_torchscript(model, example_input: torch.Tensor, path: str):
    model.eval()
    scripted = torch.jit.trace(model, example_input)
    scripted.save(path)
    print(f"TorchScript model saved: {path}")

def export_to_onnx(model, example_input: torch.Tensor, path: str):
    model.eval()
    torch.onnx.export(
        model, example_input, path,
        input_names=['input'], output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=17
    )
    print(f"ONNX model saved: {path}")

if __name__ == '__main__':
    patch_size = 32
    n_slopes = 200
    n_modes = 36

    cnn = CentroidCNN(patch_size)
    cnn.load_state_dict(torch.load("ml/centroid_cnn/model.pt"))
    export_to_torchscript(cnn, torch.zeros(1, 1, patch_size, patch_size),
                          "export/centroid_cnn.pt")

    mlp = WavefrontMLP(n_slopes, n_modes)
    mlp.load_state_dict(torch.load("ml/reconstructor/model.pt"))
    export_to_torchscript(mlp, torch.zeros(1, n_slopes),
                          "export/reconstructor.pt")
```

### Stage 3 deliverable

Trained and exported models for centroiding and reconstruction. A benchmark table comparing classical vs ML on: centroid RMS error (pixels), reconstruction RMS wavefront error (nm), and per-frame inference time (ms).

---

## 6. Stage 4 — Actuator map & DM control

### Goal

Convert the reconstructed wavefront into a set of actuator stroke commands that, when applied to the DM, physically cancel the distortion.

### Research questions to answer

- What exactly is the influence function of a DM actuator, and how is the coupling matrix measured in the lab?
- What is the difference between the influence matrix and the coupling matrix in the context of DM control?
- When computing the conjugate wavefront (-W), in what units must it be expressed for the actuator strokes (nm, µm, volts)?
- What regularisation is needed when inverting the coupling matrix (Tikhonov regularisation)?
- For the RL approach: what is a suitable reward function for AO closed-loop correction (e.g. negative RMS wavefront error, Strehl ratio proxy)?
- What is the Stable-Baselines3 PPO implementation, and how do you wrap the AO loop as a Gymnasium environment?

### 4.1 Classical coupling matrix solver

```python
# pharos/actuator.py

import numpy as np
from scipy.linalg import lstsq

def load_coupling_matrix(path: str) -> np.ndarray:
    """
    Load DM influence / coupling matrix I of shape (N_pixels_phase, N_actuators).
    Each column is the phase influence of unit stroke on actuator j.
    Research: confirm the units and normalisation of your provided matrix.
    """
    return np.load(path)

def compute_actuator_map(phase_map: np.ndarray,
                          coupling_matrix: np.ndarray,
                          rcond: float = 1e-3) -> np.ndarray:
    """
    Solve  I @ a = -W  for actuator stroke vector a.

    phase_map: (H, W) reconstructed phase in radians
    coupling_matrix: (N_phase_pts, N_actuators)
    Returns: a of shape (N_actuators,) — stroke lengths in DM units

    Research:
    - Should you use the full pupil or only active pupil points?
    - What rcond gives the best correction without actuator saturation?
    - Fried geometry: confirm that the phase evaluation points match actuator corner positions.
    """
    W_flat = -phase_map.ravel()  # conjugate of the distortion
    # Select only valid (within-pupil) phase points
    # ... (mask out points outside the pupil)
    a, _, _, _ = lstsq(coupling_matrix, W_flat, cond=rcond)
    # Clip to actuator stroke limits
    # Research: what are the min/max stroke values from your config?
    return a

def clip_actuator_strokes(a: np.ndarray, stroke_range: float) -> np.ndarray:
    """Clip actuator commands to physical stroke limits."""
    return np.clip(a, -stroke_range, stroke_range)
```

### 4.2 RL control environment

```python
# ml/rl_control/env.py

import numpy as np
import gymnasium as gym
from gymnasium import spaces

class AOClosedLoopEnv(gym.Env):
    """
    Gymnasium environment simulating an AO closed loop for RL training.

    State:   slope vector s from the WFS (2*N_active,)
    Action:  actuator stroke vector a (N_actuators,) — normalised [-1, 1]
    Reward:  negative RMS wavefront error after applying correction

    Research:
    - How do you simulate realistic Kolmogorov turbulence phase screens in Python?
      (Use the 'aotools' library or implement the FFT-based method from Fried 1965)
    - What episode length (number of frames) is appropriate for training?
    - Does the reward need shaping, or is raw -RMS_error sufficient?
    - How many training steps does PPO need to converge for a 97-actuator DM?
    """

    def __init__(self, config: dict):
        super().__init__()
        self.config = config
        n_slopes = 2 * config['n_active_subapertures']
        n_actuators = config['dm']['n_actuators']

        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(n_slopes,), dtype=np.float32)
        self.action_space = spaces.Box(
            low=-1.0, high=1.0, shape=(n_actuators,), dtype=np.float32)

    def reset(self, seed=None):
        super().reset(seed=seed)
        # Generate new turbulence phase screen
        # Research: implement Kolmogorov phase screen generation
        self.phase_screen = self._generate_phase_screen()
        obs = self._compute_slopes(self.phase_screen)
        return obs.astype(np.float32), {}

    def step(self, action: np.ndarray):
        # Scale action to physical stroke range
        stroke_range = self.config['dm']['stroke_um']
        strokes = action * stroke_range
        # Apply correction to phase screen
        correction = self._apply_dm(strokes)
        residual_phase = self.phase_screen - correction
        # Compute reward
        rms_error = np.sqrt(np.mean(residual_phase**2))
        reward = -float(rms_error)
        # Advance turbulence (frozen flow)
        self.phase_screen = self._advance_turbulence()
        obs = self._compute_slopes(self.phase_screen)
        done = False
        return obs.astype(np.float32), reward, done, False, {}

    def _generate_phase_screen(self) -> np.ndarray:
        # Research: implement FFT-based Kolmogorov phase screen
        raise NotImplementedError

    def _compute_slopes(self, phase: np.ndarray) -> np.ndarray:
        # Research: compute WFS slope response to a given phase screen
        raise NotImplementedError

    def _apply_dm(self, strokes: np.ndarray) -> np.ndarray:
        # Research: apply coupling matrix to convert strokes to phase correction
        raise NotImplementedError

    def _advance_turbulence(self) -> np.ndarray:
        # Research: frozen-flow wind model — shift phase screen by v_wind * dt
        raise NotImplementedError
```

```python
# ml/rl_control/train.py

from stable_baselines3 import PPO
from ml.rl_control.env import AOClosedLoopEnv

def train_rl_controller(config: dict, total_timesteps: int = 1_000_000):
    env = AOClosedLoopEnv(config)
    model = PPO(
        policy='MlpPolicy',
        env=env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        verbose=1,
        tensorboard_log="./logs/rl_control/"
    )
    model.learn(total_timesteps=total_timesteps)
    model.save("ml/rl_control/ppo_ao_controller")
    return model
```

### Stage 4 deliverable

Working actuator map computation (classical solver). RL training environment set up and training initiated. Validation: apply computed actuator commands to a simulated phase screen and measure residual RMS error.

---

## 7. Stage 5 — Validation & benchmarking

### Goal

Quantitatively prove that PHAROS produces correct, physically meaningful outputs. Compare classical vs ML performance rigorously.

### Research questions to answer

- What is the Strehl ratio and how do you compute it from a wavefront phase map?
- What does the phase structure function of Kolmogorov turbulence look like, and how do you test that your reconstructed maps follow it?
- How do you compute the 95% confidence interval on an r₀ estimate from a finite time-series?
- What is cProfile and line_profiler, and how do you identify the slowest line of the pipeline?

### 5.1 Metrics

```python
# benchmarks/metrics.py

import numpy as np

def rms_wavefront_error(phase_map: np.ndarray, mask: np.ndarray) -> float:
    """RMS wavefront error in radians over the valid pupil."""
    return float(np.sqrt(np.mean(phase_map[mask]**2)))

def strehl_ratio(phase_map: np.ndarray, mask: np.ndarray) -> float:
    """
    Maréchal approximation: S ≈ exp(-σ²_φ)
    Valid for small aberrations (RMS < λ/14).
    Research: when is the full Fourier PSF ratio needed instead?
    """
    sigma_sq = np.mean(phase_map[mask]**2)
    return float(np.exp(-sigma_sq))

def phase_structure_function(phase_map: np.ndarray,
                              max_sep_px: int = 50) -> tuple:
    """
    D_φ(r) = <|φ(x) - φ(x+r)|²>
    For Kolmogorov turbulence: D_φ(r) = 6.88 * (r/r₀)^(5/3)

    Research: how do you efficiently compute this over all pixel separations
    without an O(N⁴) loop? (Hint: use 2D autocorrelation via FFT)
    """
    raise NotImplementedError
```

### 5.2 Benchmark script

```python
# benchmarks/benchmark.py

import time
import numpy as np
from pharos.preprocess import preprocess, load_frame
from pharos.centroid import compute_centroids
from pharos.slopes import compute_slopes
from pharos.reconstruct import reconstruct_wavefront
from pharos.turbulence import estimate_r0_from_zernike

def benchmark_pipeline(frame_paths: list, config: dict, R: np.ndarray,
                        zernike_basis: np.ndarray, ref_centroids: np.ndarray):
    dark = np.load(config['data']['dark_frame_path'])
    flat = np.load(config['data']['flat_frame_path'])
    subapertures = build_subaperture_map(config)
    focal_length_px = (config['mla']['focal_length_mm'] /
                       config['camera']['pixel_size_um'] * 1000)

    latencies = []
    coeffs_series = []

    for path in frame_paths:
        t0 = time.perf_counter()
        frame = load_frame(path, config['camera']['bit_depth'])
        frame = preprocess(frame, dark, flat)
        centroids = compute_centroids(frame, subapertures)
        s = compute_slopes(centroids, ref_centroids, focal_length_px)
        coeffs, phase_map = reconstruct_wavefront(s, R, zernike_basis)
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1000)
        coeffs_series.append(coeffs)

    coeffs_series = np.array(coeffs_series)
    r0 = estimate_r0_from_zernike(coeffs_series,
                                   wavelength_m=550e-9,
                                   D_m=config['pupil']['diameter_px']
                                       * config['camera']['pixel_size_um'] * 1e-6)

    print(f"Median latency: {np.median(latencies):.2f} ms")
    print(f"Max latency:    {np.max(latencies):.2f} ms")
    print(f"Estimated r₀:   {r0*100:.1f} cm")
    return latencies, r0
```

### Stage 5 deliverable

A PDF or notebook benchmarking report containing: latency histogram (classical vs ML), RMS error comparison plot, r₀ and τ₀ estimates with uncertainty bars, and a phase structure function validation plot.

---

## 8. Stage 6 — Real-time integration & optimisation

### Goal

The full pipeline must run end-to-end under 10 ms per frame on the target hardware.

### Research questions to answer

- Where are the actual latency bottlenecks? Profile before optimising.
- Can frame I/O be overlapped with processing using a producer-consumer queue?
- Does CuPy give a meaningful speedup for the classical NumPy stages at your array sizes?
- What is the DM hardware SDK — can Python call it directly, or is a C extension needed?

### 8.1 Latency targets (example breakdown for 10 ms budget)

| Stage | Target (ms) |
|---|---|
| Frame load + preprocess | < 1.0 |
| Centroiding (ML inference) | < 2.0 |
| Slope assembly | < 0.2 |
| Wavefront reconstruction (ML) | < 1.0 |
| Actuator map computation | < 1.0 |
| DM command dispatch | < 2.0 |
| Overhead / margin | 2.8 |
| **Total** | **< 10.0** |

### 8.2 Real-time loop

```python
# pharos/realtime.py

import queue
import threading
import time
import numpy as np
import torch

class PHAROSRealTimeLoop:
    """
    Producer-consumer architecture:
    - Thread 1: capture frames from camera, push to queue
    - Thread 2: process frames (centroid → slopes → reconstruct → actuate)

    Research:
    - Does your camera SDK support a callback interface or polling?
    - What queue maxsize prevents memory blowup if processing falls behind?
    - How do you handle frame drops gracefully?
    """

    def __init__(self, config: dict, centroid_model_path: str,
                 reconstructor_model_path: str):
        self.config = config
        self.frame_queue = queue.Queue(maxsize=4)
        self.running = False

        # Load TorchScript models
        self.centroid_model = torch.jit.load(centroid_model_path)
        self.reconstructor = torch.jit.load(reconstructor_model_path)
        device_str = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.device = torch.device(device_str)
        self.centroid_model = self.centroid_model.to(self.device)
        self.reconstructor = self.reconstructor.to(self.device)
        self.centroid_model.eval()
        self.reconstructor.eval()

    def start(self):
        self.running = True
        self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.process_thread = threading.Thread(target=self._process_loop, daemon=True)
        self.capture_thread.start()
        self.process_thread.start()

    def stop(self):
        self.running = False
        self.capture_thread.join(timeout=2)
        self.process_thread.join(timeout=2)

    def _capture_loop(self):
        # Research: replace with your actual camera SDK call
        while self.running:
            frame = self._capture_frame()
            try:
                self.frame_queue.put_nowait(frame)
            except queue.Full:
                pass  # drop frame — log and monitor

    def _process_loop(self):
        while self.running:
            try:
                frame = self.frame_queue.get(timeout=0.05)
            except queue.Empty:
                continue
            t0 = time.perf_counter()
            actuator_commands = self._process_frame(frame)
            self._send_dm_commands(actuator_commands)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            if elapsed_ms > 10.0:
                print(f"WARNING: loop latency {elapsed_ms:.1f} ms exceeds 10 ms budget")

    def _capture_frame(self) -> np.ndarray:
        # Research: implement camera SDK frame grab here
        raise NotImplementedError

    def _process_frame(self, frame: np.ndarray) -> np.ndarray:
        # Preprocess, centroid, slopes, reconstruct, actuate
        raise NotImplementedError

    def _send_dm_commands(self, commands: np.ndarray):
        # Research: implement DM SDK command dispatch here
        raise NotImplementedError
```

### Stage 6 deliverable

Full PHAROS pipeline running in closed loop on real lab data, with logged per-frame latencies demonstrating < 10 ms operation and DM commands being dispatched correctly.

---

## 9. Python stack reference

| Package | Version | Purpose |
|---|---|---|
| `numpy` | ≥ 1.24 | Core array operations, linear algebra |
| `scipy` | ≥ 1.10 | Signal processing, SVD, curve fitting |
| `opencv-python` | ≥ 4.8 | Fast image I/O, morphological ops |
| `matplotlib` | ≥ 3.7 | Visualisation and diagnostics |
| `astropy` | ≥ 5.3 | Optical utilities, unit handling |
| `torch` | ≥ 2.0 | ML/DL model training and inference |
| `torchvision` | ≥ 0.15 | Data augmentation utilities |
| `onnx` | ≥ 1.14 | Model export |
| `onnxruntime` | ≥ 1.15 | Fast CPU/GPU ONNX inference |
| `stable-baselines3` | ≥ 2.0 | PPO reinforcement learning |
| `gymnasium` | ≥ 0.29 | RL environment interface |
| `cupy-cuda12x` | ≥ 12.0 | GPU-accelerated NumPy (optional) |
| `aotools` | ≥ 1.0 | AO-specific utilities (Zernike, phase screens) |
| `pyyaml` | ≥ 6.0 | Config file parsing |
| `tqdm` | ≥ 4.65 | Progress bars |

Install all at once:
```bash
pip install numpy scipy opencv-python matplotlib astropy torch torchvision \
            onnx onnxruntime stable-baselines3 gymnasium aotools pyyaml tqdm
```

---

## 10. Key concepts & formulae

### Wavefront slope from centroid deviation

```
sx_i = Δx_i / f        [radians]
sy_i = Δy_i / f        [radians]
```
where `f` is the lenslet focal length in pixels and `Δ` is the centroid deviation from reference.

### Zernike coefficient reconstruction

```
c = R · s
```
where `R = D⁺` is the pseudo-inverse of the interaction matrix `D`, and `s` is the full slope vector.

### Phase map from Zernike coefficients

```
W(x, y) = Σ_j  c_j · Z_j(x, y)
```
where `Z_j` is the j-th Zernike polynomial evaluated on the pupil grid.

### Fried parameter from Zernike variance (Noll 1976)

```
Var(Z_j) = 0.2944 · Δ_j · (D / r₀)^(5/3) · λ²
```
where `Δ_j` is the Noll variance coefficient for mode j, `D` is the pupil diameter, and `λ` is the wavelength.

### Coherence time

```
τ₀ = 0.314 · r₀ / v_wind
```
where `v_wind` is the effective wind speed driving the turbulence (estimated from the PSD knee frequency).

### Strehl ratio (Maréchal approximation)

```
S ≈ exp(−σ²_φ)
```
where `σ²_φ` is the RMS wavefront variance in radians squared.

### Actuator command (conjugate + coupling inversion)

```
I · a = −W_flat
a = I⁺ · (−W_flat)
```
where `I` is the DM influence matrix and `W_flat` is the flattened pupil phase map.

---

## 11. Research reading list

### Essential papers

- Noll, R.J. (1976). "Zernike polynomials and atmospheric turbulence." *JOSA*, 66(3), 207–211.
  → Defines the Zernike ordering and variance coefficients for r₀ estimation.

- Fried, D.L. (1977). "Least-square fitting a wave-front distortion estimate to an array of phase-difference measurements." *JOSA*, 67(3), 370–375.
  → Foundational paper on the Fried geometry and zonal wavefront reconstruction.

- Roddier, F. (1999). *Adaptive Optics in Astronomy*. Cambridge University Press.
  → Complete reference for AO system design, WFS theory, and DM control.

- Hardy, J.W. (1998). *Adaptive Optics for Astronomical Telescopes*. Oxford University Press.
  → Comprehensive AO textbook including SH-WFS theory and real-time control.

### ML/DL for AO

- Swanson, R. et al. (2018). "Loop gain optimization for wavefront reconstruction using convolutional neural networks." *SPIE Proc.* 10703.
  → CNN-based wavefront reconstruction, early landmark paper.

- Nousiainen, J. et al. (2022). "Toward on-sky adaptive optics control using reinforcement learning." *A&A*, 664, A71.
  → RL-based DM control in a real AO system — closest to the PHAROS control objective.

- Orban de Xivry, G. et al. (2021). "Focal plane wavefront sensing with deep learning." *MNRAS*, 505(1), 959–974.
  → DL for wavefront sensing — useful for understanding domain gap and training strategies.

### Atmospheric turbulence

- Kolmogorov, A.N. (1941). "The local structure of turbulence in incompressible viscous fluid for very large Reynolds numbers." *Proc. USSR Acad. Sci.*
  → Original turbulence spectrum paper.

- Tatarski, V.I. (1961). *Wave Propagation in a Turbulent Medium*. McGraw-Hill.
  → Atmospheric propagation through turbulence — the theoretical backbone.

### Useful software references

- `aotools` documentation: https://aotools.readthedocs.io
- Stable-Baselines3 PPO: https://stable-baselines3.readthedocs.io/en/master/modules/ppo.html
- PyTorch TorchScript: https://pytorch.org/docs/stable/jit.html
- ONNX Runtime: https://onnxruntime.ai/docs/

---

## 12. Glossary

| Term | Meaning |
|---|---|
| AO | Adaptive Optics — real-time correction of wavefront distortions |
| CoM | Centre of Mass — centroiding algorithm |
| DM | Deformable Mirror — the corrective element with N actuatable pistons |
| Fried geometry | Arrangement where DM actuators sit at the corners of WFS sub-apertures |
| MLA | Microlens Array — the array of lenslets in the SH-WFS |
| Noll ordering | Standard sequential ordering of Zernike polynomials (Noll 1976) |
| PPO | Proximal Policy Optimisation — a reinforcement learning algorithm |
| r₀ | Fried parameter — the spatial coherence length of the atmosphere (larger = better) |
| RMS | Root Mean Square — measure of wavefront error magnitude |
| ROI | Region of Interest — pixel patch corresponding to one sub-aperture |
| SH-WFS | Shack-Hartmann Wavefront Sensor |
| SNR | Signal-to-Noise Ratio |
| Strehl ratio | Ratio of peak PSF intensity to diffraction limit (1 = perfect) |
| SVD | Singular Value Decomposition — used to compute the pseudo-inverse reconstructor |
| τ₀ | Coherence time — how long before the atmospheric distortion changes significantly |
| Zernike polynomial | Orthogonal basis function on the unit disk, used to decompose wavefront phase |

---

*PHAROS — Phase and Hartmann Adaptive Reconstruction with Optimised Sensing*
