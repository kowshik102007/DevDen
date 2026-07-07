import os
import joblib
import pandas as pd

MODEL_PATH = os.path.join(
    "models",
    "stock_model.pkl"
)

if os.path.exists(
    MODEL_PATH
):
    model = joblib.load(
        MODEL_PATH
    )
else:
    model = None


def get_prediction(symbol):

    try:

        file_path = os.path.join(
            "dataset",
            f"{symbol.upper()}.csv"
        )

        if not os.path.exists(
            file_path
        ):
            return None

        df = pd.read_csv(
            file_path
        )

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

        df.dropna(
            inplace=True
        )

        latest = df.iloc[-1]

        features = [[

            latest["Open"],
            latest["High"],
            latest["Low"],
            latest["Volume"],

            latest["Price_Range"],

            latest["SMA_5"],
            latest["SMA_10"],

            latest["EMA_10"],

            latest["Return"]
        ]]

        predicted_price = float(
            model.predict(
                features
            )[0]
        )

        current_price = float(
            latest["Close"]
        )

        change = (
            (
                predicted_price -
                current_price
            )
            /
            current_price
        ) * 100

        if change > 1:

            signal = "BUY"

        elif change < -1:

            signal = "SELL"

        else:

            signal = "HOLD"

        confidence = min(
            round(
                abs(change) * 15,
                2
            ),
            95
        )

        return {

            "symbol":
            symbol.upper(),

            "current_price":
            round(
                current_price,
                2
            ),

            "predicted_price":
            round(
                predicted_price,
                2
            ),

            "signal":
            signal,

            "confidence":
            confidence
        }

    except Exception as e:

        print(
            "Prediction Error:",
            e
        )

        return None