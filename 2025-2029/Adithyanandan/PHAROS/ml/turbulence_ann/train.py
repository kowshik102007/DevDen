"""Train TurbulenceANN to regress r0 and tau0 from Zernike variances."""
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import Dataset, DataLoader, random_split
    import numpy as np
    from ml.turbulence_ann.model import TurbulenceANN

    class TurbulenceDataset(Dataset):
        def __init__(self, data_path="data/sim/turbulence_dataset.npz"):
            data = np.load(data_path)
            self.features = torch.tensor(data["features"], dtype=torch.float32)
            self.labels   = torch.tensor(data["labels"],   dtype=torch.float32)

        def __len__(self):
            return len(self.features)

        def __getitem__(self, idx):
            return self.features[idx], self.labels[idx]

    def train_turbulence_ann(data_path="data/sim/turbulence_dataset.npz",
                             n_epochs=50, lr=1e-3,
                             save_path="ml/turbulence_ann/model_best.pt"):
        dataset = TurbulenceDataset(data_path)
        n_features = dataset.features.shape[1]
        n_val = int(0.1 * len(dataset))
        train_ds, val_ds = random_split(dataset, [len(dataset) - n_val, n_val])
        train_dl = DataLoader(train_ds, batch_size=512, shuffle=True, num_workers=2)
        val_dl   = DataLoader(val_ds,   batch_size=512)

        model = TurbulenceANN(n_features)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        optimiser = torch.optim.Adam(model.parameters(), lr=lr)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, n_epochs)
        criterion = nn.MSELoss()

        best_val = float("inf")
        for epoch in range(n_epochs):
            model.train()
            train_loss = 0.0
            for feats, lbls in train_dl:
                feats, lbls = feats.to(device), lbls.to(device)
                optimiser.zero_grad()
                loss = criterion(model(feats), lbls)
                loss.backward()
                optimiser.step()
                train_loss += loss.item()
            scheduler.step()

            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for feats, lbls in val_dl:
                    feats, lbls = feats.to(device), lbls.to(device)
                    val_loss += criterion(model(feats), lbls).item()
            val_loss /= len(val_dl)
            print(f"Epoch {epoch+1:3d} | train={train_loss/len(train_dl):.6f} | val={val_loss:.6f}")
            if val_loss < best_val:
                best_val = val_loss
                torch.save(model.state_dict(), save_path)

        print(f"Best model saved to {save_path}")

    if __name__ == "__main__":
        train_turbulence_ann()

except ImportError as e:
    print(f"PyTorch not available: {e}")
