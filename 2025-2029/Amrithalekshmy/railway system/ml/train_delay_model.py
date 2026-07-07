

import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder
import joblib

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'delay_model.pkl')
ENCODER_PATH = os.path.join(os.path.dirname(__file__), 'delay_train_encoder.pkl')
REPORT_PATH = os.path.join(os.path.dirname(__file__), 'delay_model_report.txt')


def load_training_data():
    filepath = os.path.join(DATA_DIR, 'historical_delays.csv')
    if not os.path.exists(filepath):
        print(f"Training data not found: {filepath}")
        print("To get training data:")
        print("  1. Download from data.gov.in (search 'train punctuality')")
        print("  2. Or search Kaggle for 'Indian Railways delay dataset'")
        print("  3. Save as data/historical_delays.csv")
        print("\nGenerating synthetic training data for demo...")
        return generate_synthetic_data()

    df = pd.read_csv(filepath)
    return df


def generate_synthetic_data():
    np.random.seed(42)
    n_samples = 10000

    # Common Kerala train numbers
    train_numbers = [
        '16606', '12076', '16650', '16346', '16329', '12431',
        '12082', '16334', '16336', '16629', '16604', '12625',
        '12626', '12601', '12602', '16525', '16526', '56361',
        '56362', '66301', '66302', '66303', '66304',
    ]

    data = []
    for _ in range(n_samples):
        train_num = np.random.choice(train_numbers)
        day_of_week = np.random.randint(0, 7)
        month = np.random.randint(1, 13)
        scheduled_hour = np.random.randint(4, 24)
        distance = np.random.uniform(10, 800)


        is_express = 1 if train_num.startswith('1') or train_num.startswith('2') else 0


        base_delay = np.random.exponential(8 if is_express else 15)


        if 6 <= month <= 9:
            base_delay *= 1.5


        if 7 <= scheduled_hour <= 10 or 17 <= scheduled_hour <= 20:
            base_delay *= 1.3

        if day_of_week >= 5:
            base_delay *= 0.85


        base_delay += distance * 0.005


        prev_delay = base_delay * np.random.uniform(0.6, 1.2) + np.random.normal(0, 3)
        prev_delay = max(0, prev_delay)


        actual_delay = max(0, base_delay + np.random.normal(0, 5))

        data.append({
            'train_number': train_num,
            'day_of_week': day_of_week,
            'month': month,
            'scheduled_hour': scheduled_hour,
            'prev_station_delay': round(prev_delay, 1),
            'distance_from_origin': round(distance, 1),
            'is_express': is_express,
            'delay_minutes': round(actual_delay, 1),
        })

    df = pd.DataFrame(data)


    synthetic_path = os.path.join(DATA_DIR, 'historical_delays.csv')
    df.to_csv(synthetic_path, index=False)
    print(f"  Saved {n_samples} synthetic records to {synthetic_path}")

    return df


def train_model(df):

    print(f"Training on {len(df)} records...")

    train_encoder = LabelEncoder()
    df['train_number_encoded'] = train_encoder.fit_transform(df['train_number'].astype(str))


    feature_cols = [
        'train_number_encoded', 'day_of_week', 'month',
        'scheduled_hour', 'prev_station_delay',
        'distance_from_origin', 'is_express'
    ]


    if 'scheduled_hour' not in df.columns and 'scheduled_arrival' in df.columns:
        df['scheduled_hour'] = pd.to_datetime(df['scheduled_arrival']).dt.hour

    if 'is_express' not in df.columns:
        df['is_express'] = df['train_number'].astype(str).apply(
            lambda x: 1 if x.startswith('1') or x.startswith('2') else 0
        )

    if 'prev_station_delay' not in df.columns:
        df['prev_station_delay'] = 0

    X = df[feature_cols].fillna(0)
    y = df['delay_minutes']


    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )


    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)


    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)

    metrics = {
        'train_mae': mean_absolute_error(y_train, train_preds),
        'test_mae': mean_absolute_error(y_test, test_preds),
        'test_rmse': np.sqrt(mean_squared_error(y_test, test_preds)),
        'test_r2': r2_score(y_test, test_preds),
    }


    importances = dict(zip(feature_cols, model.feature_importances_))

    print(f"  Train MAE: {metrics['train_mae']:.1f} minutes")
    print(f"  Test MAE:  {metrics['test_mae']:.1f} minutes")
    print(f"  Test RMSE: {metrics['test_rmse']:.1f} minutes")
    print(f"  Test R2:   {metrics['test_r2']:.3f}")


    joblib.dump(model, MODEL_PATH)
    joblib.dump(train_encoder, ENCODER_PATH)
    print(f"  Model saved to: {MODEL_PATH}")


    write_report(metrics, importances, len(df))

    return model, train_encoder, metrics


def write_report(metrics, importances, n_samples):

    with open(REPORT_PATH, 'w') as f:
        f.write("Kerala Railway Gate — Train Delay Prediction Model Report\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Training samples: {n_samples}\n")
        f.write(f"Algorithm: Random Forest Regressor (100 trees)\n\n")
        f.write("Performance Metrics:\n")
        f.write(f"  Mean Absolute Error (test): {metrics['test_mae']:.1f} minutes\n")
        f.write(f"  RMSE (test):                {metrics['test_rmse']:.1f} minutes\n")
        f.write(f"  R-squared (test):           {metrics['test_r2']:.3f}\n")
        f.write(f"  Mean Absolute Error (train): {metrics['train_mae']:.1f} minutes\n\n")
        f.write("Feature Importance:\n")
        for feat, imp in sorted(importances.items(), key=lambda x: -x[1]):
            f.write(f"  {feat:30s} {imp:.4f}\n")
        f.write(f"\nTarget: MAE under 10 minutes = PASS\n")
        f.write(f"Result: {'PASS' if metrics['test_mae'] < 10 else 'NEEDS IMPROVEMENT'}\n")

    print(f"  Report saved to: {REPORT_PATH}")


def main():
    print("=== Train Delay Prediction Model ===\n")
    df = load_training_data()
    train_model(df)
    print("\nDone!")


if __name__ == '__main__':
    main()
