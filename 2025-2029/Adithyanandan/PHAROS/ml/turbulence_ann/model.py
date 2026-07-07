try:
    import torch
    import torch.nn as nn

    class TurbulenceANN(nn.Module):
        """
        Input: Zernike coefficient variance vector, shape (n_features,)
        Output: [r₀, τ₀] — scalar estimates
        """
        def __init__(self, n_features: int):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(n_features, 128), nn.ReLU(),
                nn.Linear(128, 64), nn.ReLU(),
                nn.Linear(64, 2),
            )

        def forward(self, x: "torch.Tensor") -> "torch.Tensor":
            return self.net(x)

except ImportError:
    pass
