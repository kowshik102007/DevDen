import os
import glob
import joblib
import pandas as pd
import numpy as np

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

DATASET_FOLDER = "dataset"
MODEL_FOLDER = "models"

csv_files = glob.glob(
    os.path.join(
        DATASET_FOLDER,
        "*.csv"
    )
)

all_data = []

print(
    f"Found {len(csv_files)} CSV files"
)

for file in csv_files:

    print(
        "Reading:",
        os.path.basename(file)
    )

    df = pd.read_csv(file)

    required_cols = [
        "Open",
        "High",
        "Low",
        "Close",
        "Volume"
    ]

    if not all(
        col in df.columns
        for col in required_cols
    ):
        print(
            f"Skipping {file}"
        )
        continue

    df["Price_Range"] = (
        df["High"] -
        df["Low"]
    )

    df["SMA_5"] = (
        df["Close"]
        .rolling(5)
        .mean()
    )

    df["SMA_10"] = (
        df["Close"]
        .rolling(10)
        .mean()
    )

    df["EMA_10"] = (
        df["Close"]
        .ewm(span=10)
        .mean()
    )

    df["Return"] = (
        df["Close"]
        .pct_change()
    )

    df["Target"] = (
        df["Close"]
        .shift(-1)
    )

    df.replace(
        [np.inf, -np.inf],
        np.nan,
        inplace=True
    )

    df.dropna(
        inplace=True
    )

    all_data.append(df)

if len(all_data) == 0:

    raise Exception(
        "No valid CSV files found"
    )

data = pd.concat(
    all_data,
    ignore_index=True
)

features = [

    "Open",
    "High",
    "Low",
    "Volume",

    "Price_Range",

    "SMA_5",
    "SMA_10",

    "EMA_10",

    "Return"
]

X = data[features]

y = data["Target"]

X_train, X_test, y_train, y_test = (
    train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42
    )
)

model = RandomForestRegressor(
    n_estimators=200,
    random_state=42
)

print("Training model...")

model.fit(
    X_train,
    y_train
)

preds = model.predict(
    X_test
)

mae = mean_absolute_error(
    y_test,
    preds
)

print(
    "MAE:",
    round(mae, 2)
)

os.makedirs(
    MODEL_FOLDER,
    exist_ok=True
)

joblib.dump(
    model,
    os.path.join(
        MODEL_FOLDER,
        "stock_model.pkl"
    )
)

print(
    "Model saved successfully"
)