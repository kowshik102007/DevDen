# Employee Attrition Prediction

An end-to-end machine learning project that predicts whether an employee is likely to leave a company, using the **IBM HR Analytics Employee Attrition & Performance** dataset. The trained XGBoost model is deployed as a web app with a Flask backend and an HTML/CSS/JS frontend.

## Overview

Employee attrition is costly for organizations, and being able to flag at-risk employees early can help HR teams intervene proactively. This project covers the full pipeline — from raw data to a usable prediction tool:

- Data cleaning and exploratory analysis
- Feature encoding (binary, ordinal, one-hot)
- Handling class imbalance
- XGBoost model training and hyperparameter tuning
- Decision threshold tuning for better recall on the minority class
- Feature importance analysis
- Deployment via a Flask API + simple web form

## Dataset

[IBM HR Analytics Employee Attrition & Performance](https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset) — 1,470 employee records with 35 attributes (demographics, job role, compensation, satisfaction scores, tenure, etc.) and a binary target: `Attrition` (Yes/No).

## Project Structure

```
attrition_app/
│
├── backend/
│   ├── app.py                      # Flask app (routes, preprocessing, inference)
│   ├── xgb_attrition_model.pkl     # Trained XGBoost model
│   ├── model_columns.pkl           # Column order expected by the model
│   ├── decision_threshold.pkl      # Tuned classification threshold
│   └── nominal_cols.pkl            # Columns one-hot encoded during training
│
└── frontend/
    ├── index.html                  # Prediction form
    ├── style.css                   # Styling
    └── script.js                   # Form submission + fetch call to /predict
```

## Machine Learning Pipeline

1. **Data cleaning** — dropped non-informative columns (`EmployeeCount`, `StandardHours`, `Over18`, `EmployeeNumber`); confirmed no missing values.
2. **Encoding** — binary mapping for `Gender`/`OverTime`, ordinal mapping for `BusinessTravel`, one-hot encoding for nominal categoricals (`Department`, `EducationField`, `JobRole`, `MaritalStatus`).
3. **Train-test split** — 80/20 stratified split to preserve the ~84/16 class ratio.
4. **Baseline model** — XGBoost with `scale_pos_weight` to address class imbalance.
5. **Hyperparameter tuning** — `RandomizedSearchCV` (50 iterations, 5-fold CV, optimized for ROC-AUC).
6. **Threshold tuning** — selected a custom decision threshold (~0.41) using the precision-recall curve to improve recall on the minority (attrition) class.
7. **Feature importance** — identified top drivers of attrition: `OverTime`, `JobLevel`, `JobRole` (especially Manager/Sales roles), `StockOptionLevel`, `Department`, and tenure-related features.

## Model Performance

| Metric | Baseline | Tuned (threshold-adjusted) |
|---|---|---|
| ROC-AUC | 0.758 | 0.763 |
| Precision (Attrition=Yes) | 0.46 | 0.61 |
| Recall (Attrition=Yes) | 0.45 | 0.43 |
| F1 (Attrition=Yes) | 0.45 | 0.50 |

## Web App

The form asks for the **12 most important features** (based on feature importance analysis); all other inputs use sensible default values behind the scenes, so users don't need to fill in every original dataset field.

**Input fields:** OverTime, Job Level, Job Role, Stock Option Level, Department, Total Working Years, Years With Current Manager, Monthly Income, Years In Current Role, Work Life Balance, Num Companies Worked, Education Field.

**Output:** A predicted label (*Likely to Leave* / *Likely to Stay*) along with the model's probability score.



## How It Works (API)

The frontend sends a `POST` request to `/predict` with the 12 form fields as JSON. The backend:
1. Merges the submitted fields with default values for the remaining features.
2. Applies the same encoding used during training (binary, ordinal, one-hot).
3. Aligns columns to match the model's expected input.
4. Returns a JSON response:
```json
{
  "prediction": 1,
  "probability": 0.62,
  "label": "Likely to Leave"
}
```

## Tech Stack

- **ML:** Python, pandas, NumPy, scikit-learn, XGBoost
- **Backend:** Flask
- **Frontend:** HTML, CSS, JavaScript 
