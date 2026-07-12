#!/usr/bin/env python3
"""Keras MLP training pipeline for JananiAI risk classification.

Merged best of both backends:
  - BatchNormalization layers (MachineLearning/)
  - StandardScaler with sklearn (MachineLearning/)
  - Class weight balancing for HIGH recall (MachineLearning/)
  - EarlyStopping + ReduceLROnPlateau (MachineLearning/)
  - Float16 TFLite quantization (ml/)
  - Confusion matrix printing (ml/)
  - CLI configurability (MachineLearning/)

Multi-class: LOW=0, MODERATE=1, HIGH=2
"""

from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight

import tensorflow as tf
from tensorflow import keras

SCRIPT_DIR = Path(__file__).parent

FEATURE_ORDER = [
    "age", "gravida", "parity", "previous_complications",
    "inter_pregnancy_interval_months", "systolic_bp", "diastolic_bp",
    "hemoglobin_gdl", "gestational_age_weeks", "weight_gain_kg",
    "fetal_heart_rate", "urine_protein_dipstick", "muac_cm",
]

LABEL_MAP = {"LOW": 0, "MODERATE": 1, "HIGH": 2}
LABEL_MAP_INVERSE = {0: "LOW", 1: "MODERATE", 2: "HIGH"}

# Module-level cache for loaded model
_MODEL_CACHE: Any | None = None
_META_CACHE: dict | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train JananiAI Keras model")
    parser.add_argument(
        "--data", type=Path,
        default=SCRIPT_DIR / "data" / "phc_ml_features.csv",
        help="Path to ML training CSV",
    )
    parser.add_argument(
        "--output-dir", type=Path,
        default=SCRIPT_DIR / "model_output",
        help="Artifact output directory",
    )
    parser.add_argument("--epochs", type=int, default=100, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--test-size", type=float, default=0.2, help="Test split ratio")
    return parser.parse_args()


def build_model(input_dim: int = 13) -> keras.Sequential:
    """Build Keras MLP with BatchNormalization for better generalization."""
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,)),
        keras.layers.Dense(64, activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(32, activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(16, activation="relu"),
        keras.layers.Dense(3, activation="softmax"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def load_training_data(csv_path: Path) -> tuple:
    """Load CSV dataset and return (X, y) arrays."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Training CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)
    missing = [c for c in FEATURE_ORDER + ["risk_label"] if c not in df.columns]
    if missing:
        raise ValueError(f"Training CSV missing required columns: {missing}")

    X = df[FEATURE_ORDER].to_numpy(dtype=np.float32)
    y = df["risk_label"].map(LABEL_MAP)
    if y.isna().any():
        bad = sorted(df.loc[y.isna(), "risk_label"].astype(str).unique().tolist())
        raise ValueError(f"Unknown labels in risk_label column: {bad}")

    return X, y.to_numpy(dtype=np.int64)


def train_model(
    data_path: Path = None,
    output_dir: Path = None,
    epochs: int = 100,
    batch_size: int = 32,
    seed: int = 42,
    test_size: float = 0.2,
) -> tuple:
    """Full training pipeline: load data → scale → train → evaluate → save artifacts."""
    data_path = data_path or SCRIPT_DIR / "data" / "phc_ml_features.csv"
    output_dir = output_dir or SCRIPT_DIR / "model_output"

    np.random.seed(seed)
    tf.random.set_seed(seed)

    # Load data
    X, y = load_training_data(data_path)
    print(f"Loaded {len(y)} records, {X.shape[1]} features")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=seed, stratify=y,
    )
    print(f"Train: {len(y_train)}, Test: {len(y_test)}")

    # Scale with StandardScaler (proper sklearn)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Class weights for imbalanced dataset — critical for HIGH recall
    classes = np.array([0, 1, 2])
    cw_values = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
    class_weight = {int(c): float(w) for c, w in zip(classes, cw_values)}
    print(f"Class weights: {class_weight}")

    # Build model with BatchNormalization
    model = build_model(input_dim=len(FEATURE_ORDER))

    # Training with EarlyStopping + ReduceLROnPlateau
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=10, restore_best_weights=True,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=5, min_lr=1e-5,
        ),
    ]

    print("\nTraining Keras MLP (BatchNorm + class weights)...")
    history = model.fit(
        X_train_scaled, y_train,
        validation_data=(X_test_scaled, y_test),
        epochs=epochs,
        batch_size=batch_size,
        class_weight=class_weight,
        callbacks=callbacks,
        verbose=1,
    )

    # Evaluation
    y_pred = np.argmax(model.predict(X_test_scaled, verbose=0), axis=1)

    print("\n=== Classification Report ===")
    print(classification_report(y_test, y_pred, target_names=["LOW", "MODERATE", "HIGH"]))

    print("=== Confusion Matrix ===")
    cm = confusion_matrix(y_test, y_pred)
    print(f"         LOW  MOD  HIGH")
    print(f"LOW   {cm[0][0]:4d} {cm[0][1]:4d} {cm[0][2]:4d}")
    print(f"MOD   {cm[1][0]:4d} {cm[1][1]:4d} {cm[1][2]:4d}")
    print(f"HIGH  {cm[2][0]:4d} {cm[2][1]:4d} {cm[2][2]:4d}")

    accuracy = (y_pred == y_test).mean()
    print(f"\nTest Accuracy: {accuracy:.4f}")

    # HIGH recall check
    high_idx = y_test == 2
    if high_idx.sum() > 0:
        high_recall = (y_pred[high_idx] == 2).mean()
        print(f"HIGH Recall:  {high_recall:.4f} (target: >0.90)")

    # Save artifacts
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Keras model
    keras_path = output_dir / "janani_model.keras"
    model.save(keras_path)
    print(f"\nSaved Keras model: {keras_path}")

    # 2. TFLite (float16 quantization for smaller Android model)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_model = converter.convert()

    tflite_path = output_dir / "janani_risk_model.tflite"
    with open(tflite_path, "wb") as f:
        f.write(tflite_model)
    size_kb = len(tflite_model) / 1024
    print(f"Saved TFLite model: {tflite_path} ({size_kb:.1f} KB)")

    # 3. Scaler
    scaler_path = output_dir / "scaler.pkl"
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    print(f"Saved scaler: {scaler_path}")

    # 4. SHAP background samples (100 random scaled training rows)
    sample_size = min(100, len(X_train_scaled))
    idx = np.random.choice(len(X_train_scaled), size=sample_size, replace=False)
    shap_bg_path = output_dir / "shap_background.npy"
    np.save(shap_bg_path, X_train_scaled[idx])
    print(f"Saved SHAP background: {shap_bg_path}")

    # 5. Model metadata (includes scaler params for Android)
    meta = {
        "version": "1.0.0",
        "feature_order": FEATURE_ORDER,
        "n_features": len(FEATURE_ORDER),
        "label_map": {"0": "LOW", "1": "MODERATE", "2": "HIGH"},
        "label_map_inverse": LABEL_MAP,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_std": scaler.scale_.tolist(),
        "trained_on": "synthetic_phc_v2",
        "high_risk_recall_target": 0.90,
        "test_accuracy": float(accuracy),
    }
    meta_path = output_dir / "model_meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved metadata: {meta_path}")

    # 6. Backward-compatible normalization_params.json
    norm_path = output_dir / "normalization_params.json"
    with open(norm_path, "w") as f:
        json.dump({"mean": scaler.mean_.tolist(), "std": scaler.scale_.tolist()}, f)
    print(f"Saved normalization params: {norm_path}")

    # 7. Save model+scaler pickle for backward compat with old explain.py callers
    compat_path = output_dir / "janani_model.pkl"
    with open(compat_path, "wb") as f:
        pickle.dump({
            "model": model,
            "feature_names": FEATURE_ORDER,
            "label_map": LABEL_MAP,
            "mean": scaler.mean_,
            "std": scaler.scale_,
        }, f)
    print(f"Saved compat pickle: {compat_path}")

    return model, scaler


def _load_model_and_meta(artifacts_dir: Path = None) -> tuple:
    """Load cached model + metadata for inference."""
    global _MODEL_CACHE, _META_CACHE
    if _MODEL_CACHE is not None and _META_CACHE is not None:
        return _MODEL_CACHE, _META_CACHE

    artifacts_dir = artifacts_dir or SCRIPT_DIR / "model_output"
    meta_path = artifacts_dir / "model_meta.json"
    model_path = artifacts_dir / "janani_model.keras"

    if not meta_path.exists() or not model_path.exists():
        raise FileNotFoundError(
            f"Artifacts not found in {artifacts_dir}. Run train.py first."
        )

    with open(meta_path, "r") as f:
        meta = json.load(f)
    model = keras.models.load_model(model_path)

    _MODEL_CACHE = model
    _META_CACHE = meta
    return model, meta


def predict(patient: dict, artifacts_dir: Path = None) -> dict:
    """Predict risk for one patient dict containing all 13 features.

    Returns: {"risk_label": "HIGH", "confidence": 87.3, "class_probs": [...]}
    """
    model, meta = _load_model_and_meta(artifacts_dir=artifacts_dir)
    feature_order = meta["feature_order"]

    missing = [f for f in feature_order if f not in patient]
    if missing:
        raise KeyError(f"Patient payload missing required features: {missing}")

    x = np.array([[patient[f] for f in feature_order]], dtype=np.float32)
    x_scaled = (x - np.array(meta["scaler_mean"], dtype=np.float32)) / np.array(
        meta["scaler_std"], dtype=np.float32
    )

    probs = model.predict(x_scaled, verbose=0)[0]
    predicted_class = int(np.argmax(probs))
    label = meta["label_map"][str(predicted_class)]
    confidence = round(float(probs[predicted_class]) * 100, 1)

    return {
        "risk_label": label,
        "confidence": confidence,
        "class_probs": probs.tolist(),
    }


def main() -> None:
    args = parse_args()
    train_model(
        data_path=args.data,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        seed=args.seed,
        test_size=args.test_size,
    )


if __name__ == "__main__":
    main()