"""Convenience script: generate datasets then train all three models sequentially."""
import subprocess, sys

steps = [
    # Stage 3a: Centroid CNN (dataset is on-the-fly, no generation needed)
    [sys.executable, "ml/centroid_cnn/train.py"],
    # Stage 3b: Reconstructor dataset + training
    [sys.executable, "ml/reconstructor/dataset.py", "--generate", "--n-samples", "100000"],
    [sys.executable, "ml/reconstructor/train.py"],
    # Stage 3c: Turbulence ANN dataset + training
    [sys.executable, "ml/turbulence_ann/dataset.py", "--generate", "--n-samples", "50000"],
    [sys.executable, "ml/turbulence_ann/train.py"],
    # Export all models
    [sys.executable, "export/export_models.py"],
]

for cmd in steps:
    print(f"\n>>> {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"FAILED: {cmd}")
        sys.exit(1)

print("\nAll models trained and exported.")
