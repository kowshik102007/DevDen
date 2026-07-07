try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, random_split
    from ml.centroid_cnn.model import CentroidCNN
    from ml.centroid_cnn.dataset import SyntheticSpotDataset

    def train_centroid_cnn(patch_size: int = 32, n_epochs: int = 50,
                            lr: float = 1e-3,
                            save_path: str = "ml/centroid_cnn/model_best.pt"):
        dataset = SyntheticSpotDataset(n_samples=50000, patch_size=patch_size)
        n_val = int(0.1 * len(dataset))
        train_ds, val_ds = random_split(dataset, [len(dataset) - n_val, n_val])
        train_dl = DataLoader(train_ds, batch_size=256, shuffle=True, num_workers=4)
        val_dl = DataLoader(val_ds, batch_size=256)

        model = CentroidCNN(patch_size)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        optimiser = torch.optim.Adam(model.parameters(), lr=lr)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, n_epochs)
        criterion = nn.MSELoss()

        best_val = float("inf")
        for epoch in range(n_epochs):
            model.train()
            train_loss = 0.0
            for patches, targets in train_dl:
                patches, targets = patches.to(device), targets.to(device)
                optimiser.zero_grad()
                loss = criterion(model(patches), targets)
                loss.backward()
                optimiser.step()
                train_loss += loss.item()
            scheduler.step()

            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for patches, targets in val_dl:
                    patches, targets = patches.to(device), targets.to(device)
                    val_loss += criterion(model(patches), targets).item()

            val_loss /= len(val_dl)
            print(f"Epoch {epoch+1:3d} | train={train_loss/len(train_dl):.4f} | val={val_loss:.4f}")
            if val_loss < best_val:
                best_val = val_loss
                torch.save(model.state_dict(), save_path)

        print(f"Best model saved to {save_path}")

    if __name__ == "__main__":
        train_centroid_cnn()

except ImportError:
    print("PyTorch not available.")
