# main.py
from preprocessing import load_and_preprocess
from eda import run_eda
from models import train_models
from evaluate import evaluate_models

# Step 1: Load and preprocess
X_scaled, y, X_imputed = load_and_preprocess("data_FraudDetection_JAR2020.csv")

# Step 2: EDA (comment this out after first run!)
run_eda(X_imputed, y)

# Step 3: Train models
iso_scores, xgb_scores = train_models(X_scaled, y)

# Step 4: Evaluate
evaluate_models(y, iso_scores, xgb_scores)