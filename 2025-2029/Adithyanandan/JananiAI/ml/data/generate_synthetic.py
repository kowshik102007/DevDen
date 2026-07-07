#!/usr/bin/env python3
"""
Synthetic HMIS-schema patient data generator for JananiAI.
Generates 5000 records with ~15% HIGH, ~25% MODERATE, ~60% LOW risk distribution.
"""

import random
import json
from pathlib import Path

OUTPUT_FILE = Path(__file__).parent / "synthetic_patients.json"

random.seed(42)

def assign_risk_label(
    systolic_bp, diastolic_bp, hemoglobin_gdl,
    gestational_age_weeks, fetal_heart_rate,
    age, previous_complications, urine_protein
):
    """Assign risk label based on clinical rules."""

    # HIGH risk: specific dangerous situations (~15%)
    # Only these combinations warrant HIGH:
    if systolic_bp >= 160:
        return "HIGH"
    if hemoglobin_gdl < 7.0:
        return "HIGH"
    if age < 18 and previous_complications >= 1:
        return "HIGH"
    if gestational_age_weeks > 40 and fetal_heart_rate < 110:
        return "HIGH"

    # MODERATE risk: borderline (~25%)
    if systolic_bp >= 140:
        return "MODERATE"
    if hemoglobin_gdl < 9.0:
        return "MODERATE"
    if urine_protein >= 2:
        return "MODERATE"
    if previous_complications >= 1:
        return "MODERATE"

    # Default to LOW
    return "LOW"


def generate_patient_record(patient_id):
    """Generate a single patient record."""
    # Age distribution (weighted toward 20-30)
    age = random.choices(
        list(range(15, 46)),
        weights=[1, 1, 2, 3, 5, 8, 12, 15, 18, 20, 22, 22, 20, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1]
    )[0]

    # Mostly normal BP (85% normal range)
    if random.random() < 0.85:
        systolic_bp = random.randint(100, 129)
        diastolic_bp = random.randint(60, 84)
    elif random.random() < 0.70:
        systolic_bp = random.randint(130, 139)
        diastolic_bp = random.randint(85, 89)
    else:
        systolic_bp = random.randint(140, 180)
        diastolic_bp = random.randint(90, 120)

    # Hemoglobin - cluster around dangerous values to get ~15% HIGH
    if random.random() < 0.15:
        # ~15% chance of problematic hemoglobin
        if random.random() < 0.40:
            hemoglobin_gdl = round(random.uniform(5.0, 7.0), 1)  # Severe anaemia -> HIGH
        else:
            hemoglobin_gdl = round(random.uniform(7.0, 9.0), 1)  # Moderate -> MODERATE
    elif random.random() < 0.20:
        hemoglobin_gdl = round(random.uniform(9.0, 10.4), 1)  # Mild anaemia -> MODERATE
    else:
        hemoglobin_gdl = round(random.uniform(10.5, 14.0), 1)  # Normal

    # Gestational age (normal distribution centered around 24 weeks)
    gestational_age_weeks = min(42, max(8, int(random.gauss(24, 8))))

    # Weight gain (most normal, some low)
    if random.random() < 0.75:
        weight_gain_kg = round(random.uniform(6.0, 15.0), 1)
    else:
        weight_gain_kg = round(random.uniform(-1.0, 5.9), 1)

    # Fetal heart rate (mostly normal 110-160)
    if random.random() < 0.85:
        fetal_heart_rate = random.randint(110, 160)
    elif random.random() < 0.70:
        fetal_heart_rate = random.randint(100, 109)
    else:
        fetal_heart_rate = random.randint(161, 180)

    # Urine protein (90% none/trace)
    urine_protein_dipstick = random.choices([0, 1, 2, 3, 4], weights=[82, 10, 5, 2, 1])[0]

    # Primigravida probability
    is_primigravida = random.random() < 0.35
    gravida = 1 if is_primigravida else random.randint(2, 8)
    parity = 0 if is_primigravida else random.randint(0, min(gravida - 1, 7))

    inter_pregnancy_interval = 0 if is_primigravida else random.randint(18, 120)
    if inter_pregnancy_interval < 18:
        inter_pregnancy_interval = random.randint(6, 17)

    muac_cm = round(random.uniform(21.0, 32.0), 1)
    if random.random() < 0.20:
        muac_cm = round(random.uniform(18.0, 20.9), 1)

    previous_complications = random.choices([0, 1, 2], weights=[75, 20, 5])[0]

    risk_label = assign_risk_label(
        systolic_bp, diastolic_bp, hemoglobin_gdl,
        gestational_age_weeks, fetal_heart_rate,
        age, previous_complications, urine_protein_dipstick
    )

    return {
        "patient_id": patient_id,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp,
        "hemoglobin_gdl": hemoglobin_gdl,
        "gestational_age_weeks": gestational_age_weeks,
        "weight_gain_kg": weight_gain_kg,
        "fetal_heart_rate": fetal_heart_rate,
        "urine_protein_dipstick": urine_protein_dipstick,
        "gravida": gravida,
        "parity": parity,
        "age": age,
        "previous_complications": previous_complications,
        "inter_pregnancy_interval_months": inter_pregnancy_interval,
        "muac_cm": muac_cm,
        "risk_label": risk_label
    }


def generate_dataset(n_records=5000):
    """Generate the full synthetic dataset."""
    records = []
    for i in range(n_records):
        records.append(generate_patient_record(i + 1))

    labels = [r["risk_label"] for r in records]
    high_count = labels.count("HIGH")
    moderate_count = labels.count("MODERATE")
    low_count = labels.count("LOW")

    print(f"Generated distribution: HIGH={high_count} ({high_count/n_records*100:.1f}%), "
          f"MODERATE={moderate_count} ({moderate_count/n_records*100:.1f}%), "
          f"LOW={low_count} ({low_count/n_records*100:.1f}%)")

    return records


def main():
    print("Generating 5000 synthetic patient records...")
    records = generate_dataset(5000)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(records, f, indent=2)

    print(f"Saved to {OUTPUT_FILE}")
    return records


if __name__ == "__main__":
    main()