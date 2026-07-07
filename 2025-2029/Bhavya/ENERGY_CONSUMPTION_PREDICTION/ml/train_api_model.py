import pandas as pd
import joblib
import os
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


DATA_PATH = "ml/data/processed_energy_data.csv"
MODEL_DIR = "backend/saved_model"

os.makedirs(MODEL_DIR, exist_ok=True)


def load_data():
    df = pd.read_csv(DATA_PATH)
    print("Dataset loaded successfully")
    print("Shape:", df.shape)
    return df


def prepare_data(df):
    target = "Appliances"

    features = [
        "T_out",
        "RH_out",
        "hour",
        "day",
        "month",
        "weekday",
        "is_weekend"
    ]

    X = df[features]
    y = df[target]

    print("\nFeatures used:")
    print(features)

    return X, y, features


def evaluate_model(name, y_test, predictions):
    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions)

    print(f"\n{name} Results")
    print(f"MAE  : {mae:.2f}")
    print(f"RMSE : {rmse:.2f}")
    print(f"R2   : {r2:.4f}")

    return mae, rmse, r2


def train_models(X_train, X_test, y_train, y_test):
    models = {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(
            n_estimators=100,
            random_state=42
        ),
        "Gradient Boosting": GradientBoostingRegressor(
            random_state=42
        )
    }

    results = {}

    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(X_train, y_train)

        predictions = model.predict(X_test)
        mae, rmse, r2 = evaluate_model(name, y_test, predictions)

        results[name] = {
            "model": model,
            "mae": mae,
            "rmse": rmse,
            "r2": r2
        }

    return results


def save_best_model(results, scaler, features):
    best_model_name = min(results, key=lambda name: results[name]["rmse"])
    best_model = results[best_model_name]["model"]

    joblib.dump(best_model, f"{MODEL_DIR}/energy_model.pkl")
    joblib.dump(scaler, f"{MODEL_DIR}/scaler.pkl")
    joblib.dump(features, f"{MODEL_DIR}/feature_columns.pkl")

    print("\nBest API model saved successfully.")
    print("Best Model:", best_model_name)
    print("Saved inside:", MODEL_DIR)


if __name__ == "__main__":
    df = load_data()

    X, y, features = prepare_data(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        shuffle=False
    )

    scaler = StandardScaler()

    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    results = train_models(X_train_scaled, X_test_scaled, y_train, y_test)

    save_best_model(results, scaler, features)