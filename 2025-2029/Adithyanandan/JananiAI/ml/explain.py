#!/usr/bin/env python3
"""SHAP-based explainability + Hindi reason generation for JananiAI.

Merged best of both backends:
  - Real SHAP DeepExplainer (MachineLearning/) instead of rule-based scoring
  - Complete 13-feature × 3-risk Hindi templates with value interpolation
  - LOW-risk shortcut (skip SHAP when confidence is high)
  - Always returns exactly 3 reason strings
  - Feature-aware threshold matching (lower-is-worse, special FHR bands)
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any

import numpy as np

SCRIPT_DIR = Path(__file__).parent
MODEL_DIR = SCRIPT_DIR / "model_output"

FEATURE_ORDER = [
    "age", "gravida", "parity", "previous_complications",
    "inter_pregnancy_interval_months", "systolic_bp", "diastolic_bp",
    "hemoglobin_gdl", "gestational_age_weeks", "weight_gain_kg",
    "fetal_heart_rate", "urine_protein_dipstick", "muac_cm",
]

# Default reasons for confident LOW-risk predictions (skip SHAP)
LOW_RISK_DEFAULTS = [
    "Sab kuch theek lag raha hai — niyamit checkup jaari rakhein",
    "Abhi koi khaas khatra nahi — IFA aur calcium ki goliyaan leti rahein",
    "Agle ANC visit ka samay nishchit karein",
]

# ── Complete Hindi reason templates ──────────────────────────────────────────
# Each feature maps to {risk_label: [(threshold, template), ...]}
# Templates use {v} for value interpolation
HINDI_REASONS = {
    "systolic_bp": {
        "HIGH": [
            (160, "BP bahut zyada hai ({v} mmHg) — aaj hospital jaana zaroori hai"),
            (140, "BP zyada hai ({v} mmHg) — is hafte PHC jaana zaroori hai"),
            (0, "BP thoda zyada hai — dhyan rakhein"),
        ],
        "MODERATE": [
            (140, "BP badh raha hai ({v} mmHg) — PHC mein jaanch karaayein"),
            (0, "BP normal hai"),
        ],
        "LOW": [(0, "BP bilkul theek hai")],
    },
    "diastolic_bp": {
        "HIGH": [
            (110, "Neecha BP bahut zyada hai ({v} mmHg) — turant hospital jaayein"),
            (90, "Neecha BP zyada hai ({v} mmHg) — PHC dikhaayen"),
            (0, "Neecha BP thoda badha hua hai"),
        ],
        "MODERATE": [
            (90, "Neecha BP thoda badha hua hai ({v}) — nazar rakhein"),
            (0, "Neecha BP theek hai"),
        ],
        "LOW": [(0, "Neecha BP bilkul theek hai")],
    },
    "hemoglobin_gdl": {
        "HIGH": [
            (7.0, "Khoon bahut kam hai (Hb {v}) — hospital mein khoon chadhana pad sakta hai"),
            (9.0, "Khoon kam hai (Hb {v}) — iron injection zaroori hai"),
            (99.0, "Khoon thoda kam hai (Hb {v}) — iron ki goliyaan dein"),
        ],
        "MODERATE": [
            (10.5, "Khoon thoda kam hai (Hb {v}) — iron ki goliyaan roz lein"),
            (99.0, "Khoon ka star theek hai"),
        ],
        "LOW": [(99.0, "Khoon ka star bilkul theek hai (Hb {v})")],
    },
    "urine_protein_dipstick": {
        "HIGH": [
            (3, "Peshab mein bahut zyada protein mila — pre-eclampsia ka khatra hai, turant jaayein"),
            (2, "Peshab mein protein mila ({v}+) — pre-eclampsia ka dar hai, PHC jaayein"),
            (1, "Peshab mein thoda protein hai — BP aur peshab dhyan se dekhein"),
            (0, "Peshab mein protein nahi"),
        ],
        "MODERATE": [
            (2, "Peshab mein protein hai — BP ke saath milaakar check karein"),
            (1, "Peshab mein thoda protein hai — agla check zaroor karein"),
            (0, "Peshab bilkul theek hai"),
        ],
        "LOW": [(0, "Peshab bilkul saaf hai")],
    },
    "fetal_heart_rate": {
        "HIGH": [
            (109, "Bachche ki dhadkan bahut kam hai ({v} bpm) — turant hospital jaayein"),
            (160, "Bachche ki dhadkan zyada tez hai ({v} bpm) — doctor ko dikhaayen"),
            (0, "Bachche ki dhadkan mein kuch antar hai — jaanch zaroori hai"),
        ],
        "MODERATE": [
            (0, "Bachche ki dhadkan thodi aniyamit hai — dhyan rakhein"),
        ],
        "LOW": [(0, "Bachche ki dhadkan bilkul theek hai ({v} bpm)")],
    },
    "muac_cm": {
        "HIGH": [
            (22.0, "Maa ka poshan bahut kam hai (MUAC {v} cm) — poshtik khana aur iron zaroori hai"),
            (99.0, "Poshan thoda kam hai — acha khana khaayen"),
        ],
        "MODERATE": [
            (23.0, "Maa ka poshan thoda kam hai (MUAC {v} cm) — poshtik khana badhaayen"),
            (99.0, "Poshan theek hai"),
        ],
        "LOW": [(99.0, "Poshan bilkul theek hai")],
    },
    "weight_gain_kg": {
        "HIGH": [
            (0.0, "Wajan nahi badha — bachcha theek se nahi badh raha, doctor dikhaayen"),
            (99.0, "Wajan bahut zyada badha — diabetes ki jaanch karaayen"),
        ],
        "MODERATE": [
            (0.0, "Wajan thoda kam badha hai — zyada aur achha khaana khaayein"),
            (99.0, "Wajan theek se badh raha hai"),
        ],
        "LOW": [(99.0, "Wajan bilkul sahi se badh raha hai")],
    },
    "age": {
        "HIGH": [
            (17, "Maa bahut choti hai (umra {v} saal) — zyada dhyan rakhna zaroori hai"),
            (35, "Maa ki umra zyada hai ({v} saal) — extra check-up zaroori hai"),
            (0, "Umra se thoda khatra hai"),
        ],
        "MODERATE": [
            (17, "Maa choti hai ({v} saal) — zyada dhyan rakhein"),
            (35, "Maa ki umra {v} saal hai — niyamit jaanch karaayen"),
            (0, "Umra theek hai"),
        ],
        "LOW": [(0, "Umra bilkul theek hai")],
    },
    "previous_complications": {
        "HIGH": [(1, "Pehle pregnancy mein takleef hui thi — is baar zyada dhyan rakhein")],
        "MODERATE": [(1, "Pehle pregnancy mein kuch takleef thi — sawdhan rahein")],
        "LOW": [(0, "Pehle pregnancy mein koi takleef nahi thi")],
    },
    "gravida": {
        "HIGH": [(5, "Bahut zyada baadha pregnancy ({v}vi) — zyada khatra ho sakta hai")],
        "MODERATE": [(4, "Yeh {v}vi pregnancy hai — dhyan rakhein")],
        "LOW": [(0, "Pregnancy ka number theek hai")],
    },
    "parity": {
        "HIGH": [(4, "Bahut zyada prasooti ({v}) — zyada dhyan zaroori hai")],
        "MODERATE": [(3, "{v} pehle prasooti — sawdhan rahein")],
        "LOW": [(0, "Pehle ki prasootiyaan theek rahi hain")],
    },
    "inter_pregnancy_interval_months": {
        "HIGH": [
            (17, "Dono pregnancies ke beech bahut kam waqt ({v} mahine) — khatra zyada hai"),
            (0, "Pehle delivery ke baad waqt kam tha"),
        ],
        "MODERATE": [
            (17, "Pregnancies ke beech waqt thoda kam tha ({v} mahine)"),
            (0, "Interval theek hai"),
        ],
        "LOW": [(0, "Pregnancies ke beech ka waqt bilkul sahi hai")],
    },
    "gestational_age_weeks": {
        "HIGH": [
            (36, "Bachcha samay se pehle aa sakta hai ({v} hafte) — hospital ke paas rahein"),
            (0, "Pregnancy ki avadhi par dhyan rakhein"),
        ],
        "MODERATE": [(0, "Pregnancy ki avadhi theek hai")],
        "LOW": [(0, "Pregnancy ki avadhi bilkul sahi hai")],
    },
}


def _format_value(raw_value: float, as_int: bool = False) -> str:
    if as_int:
        return str(int(round(raw_value)))
    return str(round(float(raw_value), 1))


def get_hindi_reason(feature_name: str, raw_value: float, risk_label: str) -> str:
    """Match Hindi reason template for feature/value/risk combination."""
    templates = HINDI_REASONS.get(feature_name, {}).get(risk_label, [])
    if not templates:
        return f"{feature_name} mein kuch antar hai — dhyan rakhein"

    # Special: age has both low-age and high-age risk
    if feature_name == "age":
        if raw_value <= 17:
            return templates[0][1].replace("{v}", _format_value(raw_value, as_int=True))
        if raw_value >= 35:
            return templates[1][1].replace("{v}", _format_value(raw_value, as_int=True))
        return templates[-1][1].replace("{v}", _format_value(raw_value, as_int=True))

    # Special: fetal HR has both bradycardia and tachycardia bands
    if feature_name == "fetal_heart_rate":
        if raw_value <= 109:
            return templates[0][1].replace("{v}", _format_value(raw_value, as_int=True))
        if raw_value >= 161 and len(templates) > 1:
            return templates[1][1].replace("{v}", _format_value(raw_value, as_int=True))
        return templates[-1][1].replace("{v}", _format_value(raw_value, as_int=True))

    # Features where LOWER value is worse (reverse threshold matching)
    lower_is_worse = {
        "hemoglobin_gdl", "muac_cm", "weight_gain_kg",
        "inter_pregnancy_interval_months", "gestational_age_weeks",
    }

    if feature_name in lower_is_worse:
        for thresh, msg in templates:
            if raw_value <= thresh:
                return msg.replace("{v}", _format_value(raw_value))
    else:
        # HIGHER value is worse (standard threshold matching)
        for thresh, msg in templates:
            if raw_value >= thresh:
                return msg.replace("{v}", _format_value(raw_value))

    return templates[-1][1].replace("{v}", _format_value(raw_value))


def _to_predicted_class_shap(shap_values: Any, predicted_class: int) -> np.ndarray:
    """Normalize SHAP outputs across versions to a 1D feature vector."""
    if isinstance(shap_values, list):
        return np.asarray(shap_values[predicted_class][0], dtype=np.float32)
    arr = np.asarray(shap_values)
    if arr.ndim == 3 and arr.shape[0] == 1:
        return arr[0, :, predicted_class].astype(np.float32)
    if arr.ndim == 3 and arr.shape[1] == 1:
        return arr[predicted_class, 0, :].astype(np.float32)
    if arr.ndim == 2:
        return arr[0].astype(np.float32)
    raise ValueError(f"Unsupported SHAP output shape: {arr.shape}")


def get_shap_top_features(model, x_background, patient_scaled, top_n=3):
    """Return top-N features by absolute SHAP value for predicted class."""
    import shap
    explainer = shap.DeepExplainer(model, x_background)
    shap_values = explainer.shap_values(patient_scaled)

    probs = model.predict(patient_scaled, verbose=0)[0]
    predicted_class = int(np.argmax(probs))
    class_shap = _to_predicted_class_shap(shap_values, predicted_class)

    ranked = sorted(
        zip(FEATURE_ORDER, class_shap),
        key=lambda item: abs(float(item[1])),
        reverse=True,
    )
    return [(name, float(val)) for name, val in ranked[:top_n]]


def load_model():
    """Load trained model with normalization params (backward compatible)."""
    pkl_path = MODEL_DIR / "janani_model.pkl"
    if pkl_path.exists():
        with open(pkl_path, "rb") as f:
            data = pickle.load(f)
        return data["model"], data["feature_names"], data["label_map"], data["mean"], data["std"]

    # Fallback to .keras + meta
    meta_path = MODEL_DIR / "model_meta.json"
    keras_path = MODEL_DIR / "janani_model.keras"
    import tensorflow as tf
    with open(meta_path) as f:
        meta = json.load(f)
    model = tf.keras.models.load_model(keras_path)
    return (
        model, meta["feature_order"], meta["label_map_inverse"],
        np.array(meta["scaler_mean"]), np.array(meta["scaler_std"]),
    )


def get_risk_explanation(features_dict: dict) -> tuple:
    """Full pipeline: predict → SHAP/fallback → top 3 Hindi reasons.

    Args:
        features_dict: dict mapping feature name to value

    Returns:
        (risk_label: str, reasons: list of 3 Hindi strings, confidence: float)
    """
    model, feat_names, label_map, mean, std = load_model()

    # Build feature vector
    raw = np.array([[features_dict.get(name, 0) for name in FEATURE_ORDER]], dtype=np.float32)
    x = (raw - mean) / (std + 1e-8)

    # Predict
    proba = model.predict(x, verbose=0)[0]
    pred_idx = int(np.argmax(proba))
    confidence = float(proba[pred_idx])

    label_inverse = {v: k for k, v in label_map.items()} if isinstance(label_map, dict) else {0: "LOW", 1: "MODERATE", 2: "HIGH"}
    risk_label = label_inverse.get(pred_idx, "LOW")

    # LOW with high confidence — skip SHAP, return defaults
    if risk_label == "LOW" and confidence >= 0.75:
        return risk_label, LOW_RISK_DEFAULTS[:3], round(confidence * 100, 1)

    # Try SHAP-based explanation
    reasons = []
    shap_detail = []
    try:
        shap_bg_path = MODEL_DIR / "shap_background.npy"
        if shap_bg_path.exists():
            background = np.load(shap_bg_path)
            top_features = get_shap_top_features(model, background, x, top_n=3)
            for feat_name, shap_val in top_features:
                raw_val = float(features_dict.get(feat_name, 0))
                reasons.append(get_hindi_reason(feat_name, raw_val, risk_label))
                shap_detail.append({
                    "feature": feat_name,
                    "shap_value": round(shap_val, 4),
                    "raw_value": raw_val,
                })
    except Exception:
        # SHAP failed — fall back to rule-based scoring
        pass

    # If SHAP didn't produce reasons, use rule-based fallback
    if len(reasons) < 3:
        reason_scores = []

        sbp = features_dict.get("systolic_bp", 120)
        if sbp >= 140:
            reason_scores.append(("systolic_bp", sbp - 140 + 10))
        dbp = features_dict.get("diastolic_bp", 80)
        if dbp >= 90:
            reason_scores.append(("diastolic_bp", dbp - 90 + 5))

        hb = features_dict.get("hemoglobin_gdl", 12)
        if hb < 9.0:
            reason_scores.append(("hemoglobin_gdl", (9.0 - hb) * 3))

        up = features_dict.get("urine_protein_dipstick", 0)
        if up >= 1:
            reason_scores.append(("urine_protein_dipstick", up * 4))

        fhr = features_dict.get("fetal_heart_rate", 140)
        if fhr < 110 or fhr > 160:
            reason_scores.append(("fetal_heart_rate", abs(fhr - 135)))

        age = features_dict.get("age", 25)
        if age < 18 or age > 35:
            reason_scores.append(("age", 5))

        pc = features_dict.get("previous_complications", 0)
        if pc >= 1:
            reason_scores.append(("previous_complications", pc * 5))

        muac = features_dict.get("muac_cm", 25)
        if muac < 22.5:
            reason_scores.append(("muac_cm", (22.5 - muac) * 2))

        wg = features_dict.get("weight_gain_kg", 8)
        if wg < 4:
            reason_scores.append(("weight_gain_kg", (4 - wg) * 2))

        reason_scores.sort(key=lambda x: -x[1])

        for feat_key, _ in reason_scores:
            if len(reasons) >= 3:
                break
            raw_val = float(features_dict.get(feat_key, 0))
            reason_text = get_hindi_reason(feat_key, raw_val, risk_label)
            if reason_text not in reasons:
                reasons.append(reason_text)

    # Fill to exactly 3
    defaults = [
        "Doctor se milkar salah lein",
        "Regular checkup zaroori hai",
        "Swasthya ki dekhbhal karein",
    ]
    while len(reasons) < 3:
        reasons.append(defaults[len(reasons)])

    return risk_label, reasons[:3], round(confidence * 100, 1)


def explain(
    patient: dict,
    model: Any,
    scaler_mean: list,
    scaler_std: list,
    shap_background: np.ndarray,
    top_n: int = 3,
    low_confidence_shap_threshold: float = 75.0,
) -> dict:
    """Full pipeline: predict → SHAP → top 3 Hindi reasons.

    Used by the API backend for server-side explanations.
    """
    missing = [f for f in FEATURE_ORDER if f not in patient]
    if missing:
        raise KeyError(f"Patient payload missing required features: {missing}")

    x_raw = np.array([[patient[f] for f in FEATURE_ORDER]], dtype=np.float32)
    x_scaled = (x_raw - np.array(scaler_mean, dtype=np.float32)) / np.array(
        scaler_std, dtype=np.float32
    )

    probs = model.predict(x_scaled, verbose=0)[0]
    pred_class = int(np.argmax(probs))
    label_map = {0: "LOW", 1: "MODERATE", 2: "HIGH"}
    risk_label = label_map[pred_class]
    confidence = round(float(probs[pred_class]) * 100, 1)

    if risk_label == "LOW" and confidence >= low_confidence_shap_threshold:
        return {
            "risk_label": risk_label,
            "confidence": confidence,
            "reasons": LOW_RISK_DEFAULTS,
            "shap_top_features": [],
        }

    top_features = get_shap_top_features(
        model=model, x_background=shap_background,
        patient_scaled=x_scaled, top_n=top_n,
    )

    reasons = []
    shap_detail = []
    for feat_name, shap_val in top_features:
        raw_val = float(patient[feat_name])
        reasons.append(get_hindi_reason(feat_name, raw_val, risk_label))
        shap_detail.append({
            "feature": feat_name,
            "shap_value": round(float(shap_val), 4),
            "raw_value": patient[feat_name],
        })

    while len(reasons) < 3:
        reasons.append("Zyada nazar rakhein aur agla ANC check-up time par karein")

    return {
        "risk_label": risk_label,
        "confidence": confidence,
        "reasons": reasons[:3],
        "shap_top_features": shap_detail,
    }


def main():
    """Test on sample cases."""
    test_cases = [
        {"systolic_bp": 155, "diastolic_bp": 100, "hemoglobin_gdl": 6.5,
         "gestational_age_weeks": 38, "fetal_heart_rate": 105, "urine_protein_dipstick": 3,
         "gravida": 2, "parity": 1, "age": 17, "weight_gain_kg": 3.0,
         "previous_complications": 1, "inter_pregnancy_interval_months": 0, "muac_cm": 19.5},

        {"systolic_bp": 148, "diastolic_bp": 96, "hemoglobin_gdl": 8.2,
         "gestational_age_weeks": 32, "fetal_heart_rate": 145, "urine_protein_dipstick": 2,
         "gravida": 3, "parity": 2, "age": 28, "weight_gain_kg": 8.0,
         "previous_complications": 0, "inter_pregnancy_interval_months": 36, "muac_cm": 23.5},

        {"systolic_bp": 110, "diastolic_bp": 70, "hemoglobin_gdl": 11.5,
         "gestational_age_weeks": 20, "fetal_heart_rate": 150, "urine_protein_dipstick": 0,
         "gravida": 1, "parity": 0, "age": 22, "weight_gain_kg": 5.0,
         "previous_complications": 0, "inter_pregnancy_interval_months": 0, "muac_cm": 26.0},

        {"systolic_bp": 118, "diastolic_bp": 75, "hemoglobin_gdl": 12.0,
         "gestational_age_weeks": 28, "fetal_heart_rate": 152, "urine_protein_dipstick": 0,
         "gravida": 2, "parity": 1, "age": 26, "weight_gain_kg": 7.5,
         "previous_complications": 0, "inter_pregnancy_interval_months": 30, "muac_cm": 27.0},
    ]

    print("=== JananiAI SHAP Reason Explanation Tests ===\n")
    for i, features in enumerate(test_cases):
        risk, reasons, conf = get_risk_explanation(features)
        print(f"Case {i+1}:")
        print(f"  Risk: {risk} ({conf}% confidence)")
        print(f"  Reasons:")
        for r in reasons:
            print(f"    — {r}")
        print()


if __name__ == "__main__":
    main()