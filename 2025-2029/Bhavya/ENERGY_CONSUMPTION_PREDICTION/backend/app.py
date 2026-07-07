from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
from datetime import datetime
import os


app = Flask(__name__)
CORS(app)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "saved_model", "energy_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "saved_model", "scaler.pkl")
FEATURES_PATH = os.path.join(BASE_DIR, "saved_model", "feature_columns.pkl")


model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
feature_columns = joblib.load(FEATURES_PATH)


@app.route("/")
def home():
    return jsonify({
        "message": "Energy Consumption Predictor API is running"
    })


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        temperature = float(data["temperature"])
        humidity = float(data["humidity"])
        date_value = data["date"]
        hour = int(data["hour"])

        date_obj = datetime.strptime(date_value, "%Y-%m-%d")

        day = date_obj.day
        month = date_obj.month
        weekday = date_obj.weekday()
        is_weekend = 1 if weekday >= 5 else 0

        input_data = pd.DataFrame([{
            "T_out": temperature,
            "RH_out": humidity,
            "hour": hour,
            "day": day,
            "month": month,
            "weekday": weekday,
            "is_weekend": is_weekend
        }])

        input_data = input_data[feature_columns]

        input_scaled = scaler.transform(input_data)

        prediction = model.predict(input_scaled)[0]
        prediction = round(float(prediction), 2)

        if prediction < 50:
            usage_level = "Low"
            suggestion = "Energy usage is expected to be low."
        elif prediction < 100:
            usage_level = "Medium"
            suggestion = "Energy usage is moderate. Monitor heavy appliances."
        else:
            usage_level = "High"
            suggestion = "Energy usage is high. Try reducing AC, heater, or heavy appliance usage."

        return jsonify({
            "predicted_energy": prediction,
            "unit": "Wh",
            "usage_level": usage_level,
            "suggestion": suggestion
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 400


if __name__ == "__main__":
    app.run(debug=True)