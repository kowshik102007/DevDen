#!/usr/bin/env python3
"""Export Keras model to TensorFlow Lite for Android inference.

Uses float16 quantization for smallest possible model size (~10 KB).
Reads from new .keras format and model_meta.json.
"""

import json
import numpy as np
from pathlib import Path

import tensorflow as tf

SCRIPT_DIR = Path(__file__).parent
MODEL_DIR = SCRIPT_DIR / "model_output"


def export_to_tflite():
    """Load Keras model and export to TFLite with float16 quantization."""
    keras_path = MODEL_DIR / "janani_model.keras"
    meta_path = MODEL_DIR / "model_meta.json"
    output_path = MODEL_DIR / "janani_risk_model.tflite"

    print("Loading Keras model...")
    model = tf.keras.models.load_model(keras_path)
    print(f"Model input: {model.input_shape}, output: {model.output_shape}")

    # Convert with float16 quantization (smaller than DEFAULT)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]

    tflite_model = converter.convert()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(tflite_model)

    size_kb = len(tflite_model) / 1024
    print(f"TFLite model saved to {output_path} ({size_kb:.1f} KB)")

    if size_kb > 2048:
        print("WARNING: Model exceeds 2MB target!")
    else:
        print(f"Model size OK (< 2MB) — excellent for Android")

    return str(output_path)


def run_inference_test(tflite_path):
    """Test the TFLite model with sample inputs."""
    print(f"\n=== Running TFLite inference test ===")

    # Load normalization params from model_meta.json
    meta_path = MODEL_DIR / "model_meta.json"
    with open(meta_path) as f:
        meta = json.load(f)
    mean = np.array(meta["scaler_mean"], dtype=np.float32)
    std = np.array(meta["scaler_std"], dtype=np.float32)
    feature_order = meta["feature_order"]

    # Load TFLite model
    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    print(f"Input shape: {input_details[0]['shape']}")
    print(f"Output shape: {output_details[0]['shape']}")

    test_cases = [
        # HIGH risk — severe pre-eclampsia
        {"age": 17, "gravida": 1, "parity": 0, "previous_complications": 0,
         "inter_pregnancy_interval_months": 0, "systolic_bp": 158, "diastolic_bp": 102,
         "hemoglobin_gdl": 7.8, "gestational_age_weeks": 32, "weight_gain_kg": 6.0,
         "fetal_heart_rate": 145, "urine_protein_dipstick": 2, "muac_cm": 21.5},
        # LOW risk — normal pregnancy
        {"age": 22, "gravida": 1, "parity": 0, "previous_complications": 0,
         "inter_pregnancy_interval_months": 0, "systolic_bp": 110, "diastolic_bp": 70,
         "hemoglobin_gdl": 11.5, "gestational_age_weeks": 20, "weight_gain_kg": 5.0,
         "fetal_heart_rate": 150, "urine_protein_dipstick": 0, "muac_cm": 26.0},
        # MODERATE risk — borderline
        {"age": 32, "gravida": 4, "parity": 3, "previous_complications": 1,
         "inter_pregnancy_interval_months": 18, "systolic_bp": 135, "diastolic_bp": 88,
         "hemoglobin_gdl": 8.5, "gestational_age_weeks": 36, "weight_gain_kg": 10.0,
         "fetal_heart_rate": 138, "urine_protein_dipstick": 1, "muac_cm": 22.0},
        # HIGH risk — severe anaemia + young mother
        {"age": 17, "gravida": 2, "parity": 1, "previous_complications": 1,
         "inter_pregnancy_interval_months": 12, "systolic_bp": 155, "diastolic_bp": 100,
         "hemoglobin_gdl": 6.5, "gestational_age_weeks": 38, "weight_gain_kg": 3.0,
         "fetal_heart_rate": 105, "urine_protein_dipstick": 3, "muac_cm": 19.5},
        # LOW risk — healthy
        {"age": 26, "gravida": 2, "parity": 1, "previous_complications": 0,
         "inter_pregnancy_interval_months": 30, "systolic_bp": 118, "diastolic_bp": 75,
         "hemoglobin_gdl": 12.0, "gestational_age_weeks": 28, "weight_gain_kg": 7.5,
         "fetal_heart_rate": 152, "urine_protein_dipstick": 0, "muac_cm": 27.0},
    ]

    labels = ["LOW", "MODERATE", "HIGH"]

    for i, case in enumerate(test_cases):
        raw = np.array([[case[name] for name in feature_order]], dtype=np.float32)
        normalized = (raw - mean) / std

        interpreter.set_tensor(input_details[0]['index'], normalized.astype(np.float32))
        interpreter.invoke()

        output = interpreter.get_tensor(output_details[0]['index'])[0]
        pred_idx = np.argmax(output)
        confidence = output[pred_idx]

        print(f"\nCase {i+1}: {labels[pred_idx]} ({confidence*100:.1f}%)")
        print(f"  Probs: LOW={output[0]:.3f}, MOD={output[1]:.3f}, HIGH={output[2]:.3f}")


def main():
    """Main export pipeline."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print("=== JananiAI TFLite Export ===\n")

    tflite_path = export_to_tflite()

    # Run inference test
    if Path(tflite_path).exists():
        run_inference_test(tflite_path)

    return tflite_path


if __name__ == "__main__":
    main()