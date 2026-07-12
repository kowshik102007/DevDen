import pandas as pd
import joblib
import os

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import numpy as np


DATA_PATH = "ml/data/processed_energy_data.csv"
MODEL_DIR = "ml/saved_model"

os.makedirs(MODEL_DIR, exist_ok=True)


def load_data():
    df = pd.read_csv(DATA_PATH)
    print("Dataset loaded successfully")
    print("Shape:", df.shape)
    return df


def prepare_features(df):
    # Target column
    target = "Appliances"

    # Drop columns that should not directly go into model
    drop_columns = ["date", target]

    X = df.drop(columns=drop_columns)
    y = df[target]

    # Keep only numeric columns
    X = X.select_dtypes(include=["int64", "float64"])

    print("\nFeatures used for training:")
    print(list(X.columns))

    return X, y


def evaluate_model(model_name, y_test, y_pred):
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print(f"\n{model_name} Results:")
    print(f"MAE  : {mae:.2f}")
    print(f"RMSE : {rmse:.2f}")
    print(f"R²   : {r2:.4f}")

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


def save_best_model(results, scaler, feature_columns):
    # Best model = lowest RMSE
    best_model_name = min(results, key=lambda name: results[name]["rmse"])
    best_model = results[best_model_name]["model"]

    joblib.dump(best_model, f"{MODEL_DIR}/energy_model.pkl")
    joblib.dump(scaler, f"{MODEL_DIR}/scaler.pkl")
    joblib.dump(feature_columns, f"{MODEL_DIR}/feature_columns.pkl")

    print("\nBest model saved successfully.")
    print("Best Model:", best_model_name)
    print("Saved at:", MODEL_DIR)


if __name__ == "__main__":
    df = load_data()

    X, y = prepare_features(df)

    feature_columns = list(X.columns)

    # Train-test split
    # shuffle=False because this is time-based energy data
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        shuffle=False
    )

    # Scaling
    scaler = StandardScaler()

    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    results = train_models(X_train_scaled, X_test_scaled, y_train, y_test)

    save_best_model(results, scaler, feature_columns)