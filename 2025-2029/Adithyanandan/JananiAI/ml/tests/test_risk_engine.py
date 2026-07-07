#!/usr/bin/env python3
"""Unit tests for JananiAI risk engine.

Tests model prediction, SHAP explanations, and Hindi reason templates.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from explain import get_risk_explanation, get_hindi_reason


def test_risk_high():
    """Test HIGH risk case — severe pre-eclampsia + young mother."""
    features = {
        "age": 17, "gravida": 2, "parity": 1, "previous_complications": 1,
        "inter_pregnancy_interval_months": 0,
        "systolic_bp": 155, "diastolic_bp": 100, "hemoglobin_gdl": 6.5,
        "gestational_age_weeks": 38, "fetal_heart_rate": 105, "urine_protein_dipstick": 3,
        "weight_gain_kg": 3.0, "muac_cm": 19.5,
    }
    risk, reasons, conf = get_risk_explanation(features)
    assert risk in ("HIGH", "MODERATE"), f"Expected HIGH/MODERATE, got {risk}"
    assert len(reasons) == 3, f"Expected 3 reasons, got {len(reasons)}"
    assert conf > 0, f"Confidence should be positive, got {conf}"
    print(f"PASS: HIGH risk case -> {risk} ({conf}%)")
    for r in reasons:
        print(f"  — {r}")


def test_risk_low():
    """Test LOW risk case — normal healthy pregnancy."""
    features = {
        "age": 22, "gravida": 1, "parity": 0, "previous_complications": 0,
        "inter_pregnancy_interval_months": 0,
        "systolic_bp": 110, "diastolic_bp": 70, "hemoglobin_gdl": 11.5,
        "gestational_age_weeks": 20, "fetal_heart_rate": 150, "urine_protein_dipstick": 0,
        "weight_gain_kg": 5.0, "muac_cm": 26.0,
    }
    risk, reasons, conf = get_risk_explanation(features)
    assert risk == "LOW", f"Expected LOW, got {risk}"
    assert len(reasons) == 3, f"Expected 3 reasons, got {len(reasons)}"
    print(f"PASS: LOW risk case -> {risk} ({conf}%)")
    for r in reasons:
        print(f"  — {r}")


def test_severe_anaemia():
    """Test severe anaemia case — should flag as HIGH or MODERATE."""
    features = {
        "age": 25, "gravida": 2, "parity": 1, "previous_complications": 0,
        "inter_pregnancy_interval_months": 24,
        "systolic_bp": 120, "diastolic_bp": 75, "hemoglobin_gdl": 6.5,
        "gestational_age_weeks": 28, "fetal_heart_rate": 150, "urine_protein_dipstick": 0,
        "weight_gain_kg": 6.0, "muac_cm": 24.0,
    }
    risk, reasons, conf = get_risk_explanation(features)
    assert risk in ("HIGH", "MODERATE"), f"Expected HIGH/MODERATE for severe anaemia, got {risk}"
    print(f"PASS: Severe anaemia case -> {risk} ({conf}%)")
    for r in reasons:
        print(f"  — {r}")


def test_moderate_risk():
    """Test MODERATE risk — borderline vitals."""
    features = {
        "age": 32, "gravida": 4, "parity": 3, "previous_complications": 1,
        "inter_pregnancy_interval_months": 18,
        "systolic_bp": 135, "diastolic_bp": 88, "hemoglobin_gdl": 8.5,
        "gestational_age_weeks": 36, "fetal_heart_rate": 138, "urine_protein_dipstick": 1,
        "weight_gain_kg": 10.0, "muac_cm": 22.0,
    }
    risk, reasons, conf = get_risk_explanation(features)
    assert risk in ("HIGH", "MODERATE"), f"Expected MODERATE/HIGH, got {risk}"
    print(f"PASS: MODERATE risk case -> {risk} ({conf}%)")
    for r in reasons:
        print(f"  — {r}")


def test_hindi_reasons():
    """Test Hindi reason template matching for various features."""
    # HIGH BP
    r = get_hindi_reason("systolic_bp", 165, "HIGH")
    assert "hospital" in r.lower() or "bahut" in r.lower(), f"Expected hospital ref for high BP: {r}"

    # Severe anaemia
    r = get_hindi_reason("hemoglobin_gdl", 6.0, "HIGH")
    assert "khoon" in r.lower(), f"Expected blood/khoon ref for anaemia: {r}"

    # Young mother
    r = get_hindi_reason("age", 16, "HIGH")
    assert "choti" in r.lower() or "umra" in r.lower(), f"Expected age ref: {r}"

    # Abnormal FHR
    r = get_hindi_reason("fetal_heart_rate", 95, "HIGH")
    assert "dhadkan" in r.lower(), f"Expected heartbeat ref: {r}"

    # LOW risk — normal
    r = get_hindi_reason("systolic_bp", 115, "LOW")
    assert "theek" in r.lower(), f"Expected 'theek' for normal BP: {r}"

    print("PASS: Hindi reason template matching OK")


def test_reason_count():
    """Verify that all predictions return exactly 3 reasons."""
    cases = [
        {"age": 22, "gravida": 1, "parity": 0, "previous_complications": 0,
         "inter_pregnancy_interval_months": 0, "systolic_bp": 110, "diastolic_bp": 70,
         "hemoglobin_gdl": 12.0, "gestational_age_weeks": 20, "fetal_heart_rate": 145,
         "urine_protein_dipstick": 0, "weight_gain_kg": 7.0, "muac_cm": 25.0},
        {"age": 40, "gravida": 5, "parity": 4, "previous_complications": 1,
         "inter_pregnancy_interval_months": 10, "systolic_bp": 170, "diastolic_bp": 110,
         "hemoglobin_gdl": 5.5, "gestational_age_weeks": 40, "fetal_heart_rate": 95,
         "urine_protein_dipstick": 3, "weight_gain_kg": 2.0, "muac_cm": 18.5},
    ]
    for i, features in enumerate(cases):
        _, reasons, _ = get_risk_explanation(features)
        assert len(reasons) == 3, f"Case {i}: Expected 3 reasons, got {len(reasons)}"
    print("PASS: All predictions return exactly 3 reasons")


def main():
    print("=== JananiAI Risk Engine Unit Tests ===\n")

    tests = [
        ("HIGH risk (pre-eclampsia + young)", test_risk_high),
        ("LOW risk (normal pregnancy)", test_risk_low),
        ("Severe anaemia", test_severe_anaemia),
        ("MODERATE risk (borderline)", test_moderate_risk),
        ("Hindi reason templates", test_hindi_reasons),
        ("Reason count contract", test_reason_count),
    ]

    passed = 0
    failed = 0

    for name, test_fn in tests:
        try:
            print(f"Running: {name}")
            test_fn()
            passed += 1
        except Exception as e:
            print(f"FAIL: {name} -> {e}")
            failed += 1
        print()

    print(f"=== Results: {passed} passed, {failed} failed ===")
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)