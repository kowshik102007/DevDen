# dashboard.py
import streamlit as st
import pandas as pd
import numpy as np
from preprocessing import load_and_preprocess
from models import train_models
from sklearn.ensemble import IsolationForest
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE
import matplotlib.pyplot as plt
import seaborn as sns

st.set_page_config(page_title="Financial Statement Anomaly Detector", layout="wide")

st.title("🔍 Financial Statement Anomaly Detection")
st.markdown("Upload a financial statement CSV to detect potential fraud using ML.")

# ── Load and train on base data (cached) ──────────────────
@st.cache_resource
def get_trained_models():
    X_scaled, y, X_imputed = load_and_preprocess("data_FraudDetection_JAR2020.csv")

    # Isolation Forest
    iso = IsolationForest(n_estimators=100, contamination=0.007,
                          random_state=42, n_jobs=-1)
    iso.fit(X_scaled)

    # XGBoost with SMOTE
    smote = SMOTE(random_state=42)
    X_res, y_res = smote.fit_resample(X_scaled, y)
    xgb = XGBClassifier(n_estimators=100, max_depth=4,
                         learning_rate=0.1, random_state=42,
                         eval_metric='logloss')
    xgb.fit(X_res, y_res)

    return iso, xgb, X_scaled.columns.tolist()

with st.spinner("Loading and training models... (first run takes ~30 seconds)"):
    iso_model, xgb_model, feature_cols = get_trained_models()

st.success("✅ Models ready!")

# ── Sidebar ────────────────────────────────────────────────
st.sidebar.header("⚙️ Settings")
threshold = st.sidebar.slider("Anomaly Score Threshold", 0.0, 1.0, 0.5, 0.01)
st.sidebar.markdown("---")
st.sidebar.info("Higher threshold = stricter fraud detection (fewer but more confident flags)")

# ── File Upload ────────────────────────────────────────────
st.header("📂 Upload Financial Data")
uploaded_file = st.file_uploader("Upload a CSV file", type=["csv"])

if uploaded_file:
    df_input = pd.read_csv(uploaded_file)
    st.subheader("Preview of Uploaded Data")
    st.dataframe(df_input.head())

    # Align columns
    missing_cols = set(feature_cols) - set(df_input.columns)
    if missing_cols:
        st.error(f"❌ Missing columns: {missing_cols}")
    else:
        df_input = df_input[feature_cols].fillna(df_input[feature_cols].median())

        # Get scores
        iso_scores = -iso_model.score_samples(df_input)
        xgb_scores = xgb_model.predict_proba(df_input)[:, 1]
        ensemble_scores = (iso_scores / iso_scores.max() +
                           xgb_scores / xgb_scores.max()) / 2

        df_input['iso_score'] = iso_scores
        df_input['xgb_score'] = xgb_scores
        df_input['ensemble_score'] = ensemble_scores
        df_input['risk_flag'] = (ensemble_scores > threshold).astype(int)
        df_input['risk_label'] = df_input['risk_flag'].map({0: '✅ Normal', 1: '🚨 Anomaly'})

        # ── Results ───────────────────────────────────────
        st.header("📊 Detection Results")
        col1, col2, col3 = st.columns(3)
        col1.metric("Total Companies", len(df_input))
        col2.metric("Flagged as Anomaly", df_input['risk_flag'].sum())
        col3.metric("Flag Rate", f"{df_input['risk_flag'].mean()*100:.2f}%")

       
        st.dataframe(df_input[['ensemble_score', 'risk_label']].style.map(
                    lambda x: 'background-color: #ffcccc' if x == '🚨 Anomaly'
                    else 'background-color: #ccffcc', subset=['risk_label']
        ))

        # ── Score Distribution ────────────────────────────
        st.header("📈 Anomaly Score Distribution")
        fig, ax = plt.subplots(figsize=(10, 4))
        ax.hist(ensemble_scores, bins=50, color='steelblue', alpha=0.7)
        ax.axvline(threshold, color='red', linestyle='--', label=f'Threshold: {threshold}')
        ax.set_xlabel('Ensemble Anomaly Score')
        ax.set_ylabel('Count')
        ax.set_title('Distribution of Anomaly Scores')
        ax.legend()
        st.pyplot(fig)

        # ── Download Results ──────────────────────────────
        st.header("⬇️ Download Results")
        csv = df_input.to_csv(index=False).encode('utf-8')
        st.download_button("Download Flagged Results as CSV", csv,
                           "anomaly_results.csv", "text/csv")

else:
    st.info("👆 Upload a CSV file with financial statement data to get started.")
    st.markdown("### 📋 Expected Input Format")
    st.markdown("Your CSV should contain the same financial ratio columns as the JAR2020 dataset.")