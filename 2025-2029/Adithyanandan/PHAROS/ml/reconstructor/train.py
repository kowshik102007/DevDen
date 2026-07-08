try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, random_split
    from ml.reconstructor.model import WavefrontMLP
    from ml.reconstructor.dataset import ReconstructorDataset

    def train_reconstructor(data_path: str = "data/sim/reconstructor_dataset.npz",
                             n_modes: int = 20, n_epochs: int = 50,
                             save_path: str = "ml/reconstructor/model_best.pt"):
        dataset = ReconstructorDataset(data_path)
        n_slopes = dataset.slopes.shape[1]
        n_val = int(0.1 * len(dataset))
        train_ds, val_ds = random_split(dataset, [len(dataset) - n_val, n_val])
        train_dl = DataLoader(train_ds, batch_size=512, shuffle=True, num_workers=4)
        val_dl = DataLoader(val_ds, batch_size=512)

        model = WavefrontMLP(n_slopes, n_modes)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, n_epochs)
        criterion = nn.MSELoss()

        best_val = float("inf")
        for epoch in range(n_epochs):
            model.train()
            train_loss = 0.0
            for slopes, coeffs in train_dl:
                slopes, coeffs = slopes.to(device), coeffs.to(device)
                optimiser.zero_grad()
                loss = criterion(model(slopes), coeffs)
                loss.backward()
                optimiser.step()
                train_loss += loss.item()
            scheduler.step()

            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for slopes, coeffs in val_dl:
                    slopes, coeffs = slopes.to(device), coeffs.to(device)
                    val_loss += criterion(model(slopes), coeffs).item()
            val_loss /= len(val_dl)
            print(f"Epoch {epoch+1:3d} | train={train_loss/len(train_dl):.6f} | val={val_loss:.6f}")
            if val_loss < best_val:
                best_val = val_loss
                torch.save(model.state_dict(), save_path)

        print(f"Best model saved to {save_path}")

    if __name__ == "__main__":
        train_reconstructor()

except ImportError:
    print("PyTorch not available.")
