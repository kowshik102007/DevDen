import numpy as np

try:
    import torch
    from torch.utils.data import Dataset

    class SyntheticSpotDataset(Dataset):
        def __init__(self, n_samples: int = 50000, patch_size: int = 32,
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
            rng = np.random.default_rng(idx)
            dx = rng.uniform(-self.max_disp, self.max_disp)
            dy = rng.uniform(-self.max_disp, self.max_disp)
            patch = self._simulate_spot(dx, dy, rng)
            return (torch.tensor(patch[None], dtype=torch.float32),
                    torch.tensor([dx, dy], dtype=torch.float32))

        def _simulate_spot(self, dx: float, dy: float, rng) -> np.ndarray:
            H = W = self.patch_size
            y, x = np.mgrid[:H, :W].astype(float)
            cx, cy = W / 2 + dx, H / 2 + dy
            sigma = 2.0
            patch = np.exp(-((x - cx)**2 + (y - cy)**2) / (2 * sigma**2))
            patch = rng.poisson(patch * self.n_photons).astype(float) / self.n_photons
            patch += rng.normal(0, self.read_noise / self.n_photons, patch.shape)
            return patch.clip(0).astype(np.float32)

except ImportError:
    pass
