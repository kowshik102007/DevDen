#!/usr/bin/env python3
"""Synthetic PHC ANC dataset generator for JananiAI.

Generates clinically realistic training data with correlated features,
PHC geography, and a 14-factor composite risk scoring system aligned
with rural Primary Health Centre workflows.

Outputs:
  data/phc_anc_visits.csv     — Full dataset with admin fields
  data/phc_ml_features.csv    — 13 ML features + risk_label only
  data/phc_high_risk_only.csv — HIGH-risk records for SHAP testing
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPT_DIR = Path(__file__).parent

FEATURE_ORDER = [
    "age",
    "gravida",
    "parity",
    "previous_complications",
    "inter_pregnancy_interval_months",
    "systolic_bp",
    "diastolic_bp",
    "hemoglobin_gdl",
    "gestational_age_weeks",
    "weight_gain_kg",
    "fetal_heart_rate",
    "urine_protein_dipstick",
    "muac_cm",
]


@dataclass(frozen=True)
class GeoUnit:
    state: str
    phc_name: str
    village: str


# Real PHC names from Telangana, AP, Karnataka — rural India
GEO_UNITS = [
    GeoUnit("Telangana", "PHC Achampet", "Kothur"),
    GeoUnit("Telangana", "PHC Lingala", "Ayyawaripalle"),
    GeoUnit("Andhra Pradesh", "PHC Kuppam", "Gudupalle"),
    GeoUnit("Andhra Pradesh", "PHC Palamaner", "Bandarlapalle"),
    GeoUnit("Karnataka", "PHC Raichur Rural", "Hutti"),
]
ASHA_WORKERS = [f"ASHA-{i:03d}" for i in range(1, 21)]


def clip_int(value: float, low: int, high: int) -> int:
    return int(np.clip(round(value), low, high))


def clip_float(value: float, low: float, high: float, ndigits: int = 1) -> float:
    return round(float(np.clip(value, low, high)), ndigits)


def sample_risk_profile(rng: np.random.Generator) -> str:
    """Latent profile steers feature distributions; final label is rule-based."""
    return str(rng.choice(["LOW", "MODERATE", "HIGH"], p=[0.68, 0.20, 0.12]))


def generate_gestational_age_weeks(rng: np.random.Generator) -> int:
    bucket = rng.choice([0, 1, 2, 3], p=[0.20, 0.25, 0.35, 0.20])
    if bucket == 0:
        return int(rng.integers(8, 15))
    if bucket == 1:
        return int(rng.integers(14, 23))
    if bucket == 2:
        return int(rng.integers(22, 33))
    return int(rng.integers(32, 41))


def generate_age(profile: str, rng: np.random.Generator) -> int:
    if profile == "HIGH" and rng.random() < 0.30:
        if rng.random() < 0.5:
            return int(rng.integers(14, 19))
        return int(rng.integers(36, 46))
    return clip_int(rng.normal(24, 4), 15, 45)


def generate_gravida(age: int, profile: str, rng: np.random.Generator) -> int:
    if age < 21:
        low, high = 1, 2
    elif age < 30:
        low, high = 1, 3
    elif age < 36:
        low, high = 2, 4
    else:
        low, high = 2, 5
    gravida = int(rng.integers(low, high + 1))
    if profile == "HIGH" and rng.random() < 0.20:
        gravida += 1
    return int(np.clip(gravida, 1, 10))


def generate_bp(profile: str, rng: np.random.Generator) -> tuple:
    if profile == "HIGH" and rng.random() < 0.55:
        if rng.random() < 0.40:
            systolic = clip_int(rng.normal(168, 10), 80, 200)
            pattern_diastolic = rng.normal(108, 8)
        else:
            systolic = clip_int(rng.normal(150, 8), 80, 200)
            pattern_diastolic = rng.normal(97, 6)
    elif profile == "MODERATE" and rng.random() < 0.35:
        systolic = clip_int(rng.normal(138, 8), 80, 200)
        pattern_diastolic = rng.normal(97, 6)
    else:
        systolic = clip_int(rng.normal(114, 10), 80, 200)
        pattern_diastolic = rng.normal(74, 7)
    correlated = systolic * 0.65 + rng.normal(0, 6)
    diastolic = clip_int(pattern_diastolic * 0.6 + correlated * 0.4, 50, 130)
    return systolic, diastolic


def generate_hemoglobin(profile: str, rng: np.random.Generator) -> float:
    if profile == "HIGH" and rng.random() < 0.55:
        if rng.random() < 0.40:
            hb = rng.normal(6.5, 0.8)
        else:
            hb = rng.normal(8.4, 0.9)
    elif profile == "MODERATE" and rng.random() < 0.40:
        hb = rng.normal(9.2, 0.8)
    else:
        hb = rng.normal(11.0, 1.2)
    return clip_float(hb, 4.0, 16.0)


def generate_fetal_heart_rate(profile: str, rng: np.random.Generator) -> int:
    if profile == "HIGH" and rng.random() < 0.20:
        if rng.random() < 0.5:
            return clip_int(rng.normal(96, 8), 100, 180)
        return clip_int(rng.normal(172, 8), 100, 180)
    return clip_int(rng.normal(140, 10), 100, 180)


def generate_urine_protein(systolic: int, diastolic: int, rng: np.random.Generator) -> int:
    if systolic >= 160 and diastolic >= 110:
        return int(rng.choice([2, 3], p=[0.45, 0.55]))
    if systolic >= 140 or diastolic >= 90:
        return int(rng.choice([0, 1, 2, 3], p=[0.30, 0.25, 0.30, 0.15]))
    return int(rng.choice([0, 1, 2, 3], p=[0.78, 0.12, 0.07, 0.03]))


def generate_weight_gain(gest_weeks: int, profile: str, rng: np.random.Generator) -> float:
    expected = gest_weeks * 0.35
    multiplier = 1.0
    if profile == "HIGH":
        roll = rng.random()
        if roll < 0.30:
            multiplier = 0.5
        elif roll < 0.55:
            multiplier = 1.6
    weight_gain = expected * multiplier + rng.normal(0, 1.0)
    return clip_float(weight_gain, 0.0, 25.0)


def generate_muac(profile: str, hb: float, rng: np.random.Generator) -> float:
    if profile == "HIGH" and hb < 10.0:
        muac = rng.normal(21.5, 1.5)
    elif profile == "MODERATE":
        muac = rng.normal(23.0, 1.5)
    else:
        muac = rng.normal(25.5, 2.0)
    return clip_float(muac, 18.0, 35.0)


def assign_label(row: dict, rng: np.random.Generator) -> str:
    """14-factor composite scoring — clinically motivated."""
    expected_weight = row["gestational_age_weeks"] * 0.35

    # DANGER criteria — any single one → HIGH
    danger = any([
        row["systolic_bp"] >= 160,
        row["diastolic_bp"] >= 110,
        row["hemoglobin_gdl"] < 7.0,
        row["urine_protein_dipstick"] >= 3,
        row["fetal_heart_rate"] < 100,
        row["fetal_heart_rate"] > 170,
        row["age"] < 16,
    ])
    if danger:
        return "HIGH"

    # Composite score for MODERATE
    score = 0.0
    if 140 <= row["systolic_bp"] < 160:
        score += 1.5
    if 90 <= row["diastolic_bp"] < 110:
        score += 1.5
    if 7.0 <= row["hemoglobin_gdl"] < 9.0:
        score += 1.5
    elif 9.0 <= row["hemoglobin_gdl"] < 10.5:
        score += 0.8
    if row["urine_protein_dipstick"] == 2:
        score += 1.5
    elif row["urine_protein_dipstick"] == 1:
        score += 0.8
    if row["weight_gain_kg"] < expected_weight * 0.6:
        score += 1.2
    if row["muac_cm"] < 22.5:
        score += 1.2
    if row["fetal_heart_rate"] < 110:
        score += 1.5
    if row["fetal_heart_rate"] > 160:
        score += 1.5
    if row["age"] < 18:
        score += 1.5
    if row["age"] > 35:
        score += 1.0
    if row["parity"] >= 4:
        score += 1.2
    if row["previous_complications"] == 1:
        score += 1.5
    if 0 < row["inter_pregnancy_interval_months"] < 18:
        score += 1.0

    score += float(rng.normal(0, 0.3))
    return "MODERATE" if score >= 3.5 else "LOW"


def generate_one_record(i: int, rng: np.random.Generator) -> dict:
    profile = sample_risk_profile(rng)
    geo = GEO_UNITS[i % len(GEO_UNITS)]

    age = generate_age(profile, rng)
    gravida = generate_gravida(age, profile, rng)
    parity = int(np.clip(gravida - 1, 0, 9))

    prev_comp_prob = 0.0 if parity == 0 else min(0.15 + parity * 0.10, 0.55)
    previous_complications = int(rng.random() < prev_comp_prob)

    if parity == 0:
        interval = 0
    else:
        interval = clip_int(rng.normal(26, 12), 6, 84)

    systolic_bp, diastolic_bp = generate_bp(profile, rng)
    hemoglobin_gdl = generate_hemoglobin(profile, rng)
    gestational_age_weeks = generate_gestational_age_weeks(rng)
    weight_gain_kg = generate_weight_gain(gestational_age_weeks, profile, rng)
    fetal_heart_rate = generate_fetal_heart_rate(profile, rng)
    urine_protein_dipstick = generate_urine_protein(systolic_bp, diastolic_bp, rng)
    muac_cm = generate_muac(profile, hemoglobin_gdl, rng)

    feature_row = {
        "age": age,
        "gravida": gravida,
        "parity": parity,
        "previous_complications": previous_complications,
        "inter_pregnancy_interval_months": interval,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp,
        "hemoglobin_gdl": hemoglobin_gdl,
        "gestational_age_weeks": gestational_age_weeks,
        "weight_gain_kg": weight_gain_kg,
        "fetal_heart_rate": fetal_heart_rate,
        "urine_protein_dipstick": urine_protein_dipstick,
        "muac_cm": muac_cm,
    }
    risk_label = assign_label(feature_row, rng)

    visit_date = date.today() - timedelta(days=int(rng.integers(0, 365)))
    visit_number = int(np.clip(round(gestational_age_weeks / 10), 1, 6))

    record = {
        "patient_id": f"PAT-{i + 1:06d}",
        "visit_id": f"VIS-{i + 1:06d}",
        "visit_date": visit_date.isoformat(),
        "visit_number": visit_number,
        "asha_worker_id": str(rng.choice(ASHA_WORKERS)),
        "phc_name": geo.phc_name,
        "state": geo.state,
        "village": geo.village,
        **feature_row,
        "risk_label": risk_label,
    }
    return record


def print_stats(df: pd.DataFrame) -> None:
    total = len(df)
    counts = df["risk_label"].value_counts().reindex(["LOW", "MODERATE", "HIGH"], fill_value=0)

    print("-" * 66)
    print("Dataset Statistics")
    print("-" * 66)
    print(f"  Total records     : {total:,}")
    for label in ["LOW", "MODERATE", "HIGH"]:
        c = int(counts[label])
        pct = (c / total * 100) if total else 0.0
        print(f"  {label:<17}: {c:<5} ({pct:5.1f}%)")

    print("\n  Vital ranges (mean +/- std):")
    for col in ["age", "hemoglobin_gdl", "systolic_bp", "diastolic_bp", "gestational_age_weeks"]:
        print(f"    {col:<24}: {df[col].mean():5.1f} +/- {df[col].std(ddof=0):4.1f}")

    severe_htn = (df["systolic_bp"] >= 160).mean() * 100
    severe_anemia = (df["hemoglobin_gdl"] < 7.0).mean() * 100
    high_protein = (df["urine_protein_dipstick"] >= 3).mean() * 100
    abnormal_fhr = ((df["fetal_heart_rate"] < 110) | (df["fetal_heart_rate"] > 160)).mean() * 100
    adolescent = (df["age"] < 18).mean() * 100

    print("\n  Danger sign frequencies:")
    print(f"    Severe hypertension (>=160): {severe_htn:4.1f}%")
    print(f"    Severe anaemia (<7 g/dL)  : {severe_anemia:4.1f}%")
    print(f"    High proteinuria (3+)     : {high_protein:4.1f}%")
    print(f"    Abnormal fetal HR         : {abnormal_fhr:4.1f}%")
    print(f"    Adolescent mother (<18)   : {adolescent:4.1f}%")
    print("-" * 66)


def generate_dataset(n: int, seed: int, out_dir: Path) -> tuple:
    rng = np.random.default_rng(seed)
    out_dir.mkdir(parents=True, exist_ok=True)

    records = [generate_one_record(i, rng) for i in range(n)]
    full_df = pd.DataFrame(records)

    anc_path = out_dir / "phc_anc_visits.csv"
    ml_path = out_dir / "phc_ml_features.csv"
    high_path = out_dir / "phc_high_risk_only.csv"

    full_df.to_csv(anc_path, index=False)

    ml_df = full_df[FEATURE_ORDER + ["risk_label"]].copy()
    ml_df.to_csv(ml_path, index=False)

    high_df = full_df[full_df["risk_label"] == "HIGH"].copy()
    high_df.to_csv(high_path, index=False)

    print_stats(full_df)
    print(f"Wrote: {anc_path}")
    print(f"Wrote: {ml_path}")
    print(f"Wrote: {high_path}")

    # Also save as JSON for backward compatibility
    json_path = out_dir / "synthetic_patients.json"
    with open(json_path, "w") as f:
        json.dump(records, f, indent=2, default=str)
    print(f"Wrote: {json_path}")

    return anc_path, ml_path, high_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate synthetic PHC ANC dataset")
    parser.add_argument("--n", type=int, default=5000, help="Number of records (default: 5000)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument(
        "--out", type=Path, default=None,
        help="Output directory for generated files (default: script directory)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    out_dir = args.out or SCRIPT_DIR
    generate_dataset(n=args.n, seed=args.seed, out_dir=out_dir)


if __name__ == "__main__":
    main()
