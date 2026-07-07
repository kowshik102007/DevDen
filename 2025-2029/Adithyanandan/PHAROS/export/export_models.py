"""Export trained PyTorch models to TorchScript (and ONNX if onnxscript available)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import torch
    from ml.centroid_cnn.model import CentroidCNN
    from ml.reconstructor.model import WavefrontMLP
    from ml.turbulence_ann.model import TurbulenceANN

    def _try_onnx(model, example_input, path: str):
        try:
            torch.onnx.export(
                model, example_input, path,
                input_names=["input"], output_names=["output"],
                dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
                opset_version=17,
            )
            print(f"  ONNX:        {path}")
        except (ImportError, ModuleNotFoundError) as e:
            print(f"  ONNX skipped ({e})")

    def export_all(patch_size: int = 32, n_slopes: int = 200,
                   n_modes: int = 20, n_turb_features: int = 20):
        Path("export").mkdir(exist_ok=True)

        specs = [
            ("CentroidCNN",   "ml/centroid_cnn/model_best.pt",    "export/centroid_cnn.pt",
             CentroidCNN(patch_size),      torch.zeros(1, 1, patch_size, patch_size)),
            ("WavefrontMLP",  "ml/reconstructor/model_best.pt",   "export/reconstructor.pt",
             WavefrontMLP(n_slopes, n_modes), torch.zeros(1, n_slopes)),
            ("TurbulenceANN", "ml/turbulence_ann/model_best.pt",  "export/turbulence_ann.pt",
             TurbulenceANN(n_turb_features),  torch.zeros(1, n_turb_features)),
        ]

        for name, src, dst, model, example in specs:
            if not Path(src).exists():
                print(f"SKIP {name} — {src} not found")
                continue
            print(f"Exporting {name}...")
            model.load_state_dict(torch.load(src, map_location="cpu"))
            model.eval()
            scripted = torch.jit.trace(model, example)
            scripted.save(dst)
            print(f"  TorchScript: {dst}")
            _try_onnx(model, example, dst.replace(".pt", ".onnx"))

        print("Export complete.")

    if __name__ == "__main__":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--patch-size",      type=int, default=32)
        parser.add_argument("--n-slopes",        type=int, default=200)
        parser.add_argument("--n-modes",         type=int, default=20)
        parser.add_argument("--n-turb-features", type=int, default=20)
        args = parser.parse_args()
        export_all(args.patch_size, args.n_slopes, args.n_modes, args.n_turb_features)

except ImportError as e:
    print(f"PyTorch not available: {e}")
