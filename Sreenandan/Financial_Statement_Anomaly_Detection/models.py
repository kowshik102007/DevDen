# models.py
import numpy as np
from sklearn.ensemble import IsolationForest
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

def train_models(X_scaled, y):

    # ── Isolation Forest ──────────────────────────────────
    print("Training Isolation Forest...")
    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=0.007,
        random_state=42,
        n_jobs=-1
    )
    iso_forest.fit(X_scaled)
    iso_scores = -iso_forest.score_samples(X_scaled)
    print("✅ Isolation Forest trained.")

    # ── XGBoost with SMOTE ────────────────────────────────
    print("Applying SMOTE for class imbalance...")
    smote = SMOTE(random_state=42)
    X_resampled, y_resampled = smote.fit_resample(X_scaled, y)
    print(f"✅ SMOTE complete. Resampled shape: {X_resampled.shape}")

    print("Training XGBoost...")
    xgb_model = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=1,
        random_state=42,
        eval_metric='logloss'
    )
    xgb_model.fit(X_resampled, y_resampled)
    xgb_scores = xgb_model.predict_proba(X_scaled)[:, 1]
    print("✅ XGBoost trained.")

    return iso_scores, xgb_scores