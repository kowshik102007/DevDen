from flask import Flask, request, jsonify, render_template
import pandas as pd
import joblib
import os

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

# Flask App
app = Flask(
    __name__,
    template_folder=FRONTEND_DIR,
    static_folder=FRONTEND_DIR,
    static_url_path=""
)

# Load saved files
model = joblib.load("xgb_attrition_model.pkl")
model_columns = joblib.load("model_columns.pkl")
threshold = joblib.load("decision_threshold.pkl")
nominal_cols = joblib.load("nominal_cols.pkl")

# Business Travel encoding
travel_map = {
    "Non-Travel": 0,
    "Travel_Rarely": 1,
    "Travel_Frequently": 2
}


@app.route("/")
def home():
    return render_template("index.html")

DEFAULTS = {
    'Age': 35,
    'BusinessTravel': 'Travel_Rarely',
    'DailyRate': 800,
    'DistanceFromHome': 7,
    'Education': 3,
    'EnvironmentSatisfaction': 3,
    'Gender': 'Male',
    'HourlyRate': 66,
    'JobInvolvement': 3,
    'JobSatisfaction': 3,
    'MaritalStatus': 'Married',
    'MonthlyRate': 14235,
    'PercentSalaryHike': 14,
    'PerformanceRating': 3,
    'RelationshipSatisfaction': 3,
    'TrainingTimesLastYear': 3,
    'YearsAtCompany': 5,
    'YearsSinceLastPromotion': 1
}
@app.route("/predict", methods=["POST"])
def predict():
    user_input = request.get_json()

    # Merge user input (the 12 important fields) with defaults (the other 18)
    data = {**DEFAULTS, **user_input}

    df = pd.DataFrame([data])

    df['Gender'] = df['Gender'].map({'Male': 1, 'Female': 0})
    df['OverTime'] = df['OverTime'].map({'Yes': 1, 'No': 0})
    df['BusinessTravel'] = df['BusinessTravel'].map(travel_map)

    df = pd.get_dummies(df, columns=nominal_cols)
    df = df.reindex(columns=model_columns, fill_value=0)
    df = df.astype(float)

    proba = model.predict_proba(df)[0][1]
    prediction = int(proba >= threshold)

    return jsonify({
        'prediction': prediction,
        'probability': round(float(proba), 4),
        'label': 'Likely to Leave' if prediction == 1 else 'Likely to Stay'
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)