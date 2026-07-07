try:
    import torch
    import torch.nn as nn

    class WavefrontMLP(nn.Module):
        """
        Input: slope vector s, shape (2 * N_active,)
        Output: Zernike coefficient vector, shape (n_modes,)
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

        def forward(self, s: "torch.Tensor") -> "torch.Tensor":
            return self.net(s)

except ImportError:
    pass
