try:
    import torch
    import torch.nn as nn

    class CentroidCNN(nn.Module):
        """
        Input: sub-aperture patch (1, H, W) normalised float
        Output: spot displacement (Δx, Δy) in pixels relative to patch centre
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
                nn.Linear(128, 2),
            )

        def forward(self, x: "torch.Tensor") -> "torch.Tensor":
            return self.regressor(self.features(x))

except ImportError:
    pass
