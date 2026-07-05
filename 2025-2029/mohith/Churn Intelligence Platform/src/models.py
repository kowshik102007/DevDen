import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from lightgbm import LGBMClassifier
from lifelines import CoxPHFitter
import shap

def train_pipeline(data_path, models_dir):
    print(f"Loading processed dataset from {data_path}...")
    df = pd.read_csv(data_path)
    
    # 1. Feature Engineering
    features_numeric = ['Tenure Months', 'Monthly Charges', 'Total Charges']
    features_categorical = [
        'Gender', 'Senior Citizen', 'Partner', 'Dependents', 'Phone Service', 
        'Multiple Lines', 'Internet Service', 'Online Security', 'Online Backup', 
        'Device Protection', 'Tech Support', 'Streaming TV', 'Streaming Movies', 
        'Contract', 'Paperless Billing', 'Payment Method'
    ]
    
    # Encode categorical features using get_dummies
    # We use cast to float so all models can read it uniformly
    df_features = df[features_numeric + features_categorical]
    X_encoded = pd.get_dummies(df_features, columns=features_categorical, drop_first=True)
    X_encoded = X_encoded.astype(float)
    
    # Save column structure for backend inference consistency
    feature_names = X_encoded.columns.tolist()
    
    # Add target columns to encoded df for modeling
    X_encoded['W'] = df['W']
    X_encoded['Y_obs'] = df['Y_obs']
    X_encoded['Y_0'] = df['Y_0']
    X_encoded['Y_1'] = df['Y_1']
    X_encoded['True_Uplift'] = df['True_Uplift']
    X_encoded['CustomerID'] = df['CustomerID']
    
    # Train-test split (80-20, stratified by observed outcome to maintain balance)
    train_df, test_df = train_test_split(
        X_encoded, test_size=0.2, random_state=42, stratify=X_encoded['Y_obs']
    )
    
    # Save train/test partitions for dashboard validation
    os.makedirs(models_dir, exist_ok=True)
    train_df.to_csv(os.path.join(models_dir, 'train_encoded.csv'), index=False)
    test_df.to_csv(os.path.join(models_dir, 'test_encoded.csv'), index=False)
    
    # Extract training matrices
    X_train = train_df[feature_names]
    y_train = train_df['Y_obs']
    
    # 2. Train Base Churn Classifier
    # Standard churn models are trained on the overall observed outcome
    print("Training Base Churn Classifier (LightGBM)...")
    base_model = LGBMClassifier(n_estimators=100, random_state=42, verbosity=-1)
    base_model.fit(X_train, y_train)
    joblib.dump(base_model, os.path.join(models_dir, 'base_classifier.joblib'))
    
    # 3. Train T-Learner (Causal Uplift Model)
    # Model 0: Trained on Control Group (W = 0)
    print("Training T-Learner Model 0 (Control Model)...")
    control_train = train_df[train_df['W'] == 0]
    X_train_c = control_train[feature_names]
    y_train_c = control_train['Y_obs']
    
    model_c = LGBMClassifier(n_estimators=100, random_state=42, verbosity=-1)
    model_c.fit(X_train_c, y_train_c)
    joblib.dump(model_c, os.path.join(models_dir, 't_learner_control.joblib'))
    
    # Model 1: Trained on Treated Group (W = 1)
    print("Training T-Learner Model 1 (Treatment Model)...")
    treated_train = train_df[train_df['W'] == 1]
    X_train_t = treated_train[feature_names]
    y_train_t = treated_train['Y_obs']
    
    model_t = LGBMClassifier(n_estimators=100, random_state=42, verbosity=-1)
    model_t.fit(X_train_t, y_train_t)
    joblib.dump(model_t, os.path.join(models_dir, 't_learner_treated.joblib'))
    
    # 4. Train Cox Proportional Hazards Model
    # Note: Cox covariates should NOT include tenure itself.
    print("Training Cox Proportional Hazards Model...")
    cox_covariates = [
        'Monthly Charges', 'Total Charges'
    ] + [col for col in feature_names if any(cat in col for cat in ['Contract', 'Internet Service', 'Tech Support', 'Payment Method'])]
    
    # Prepare dataframe for Cox model (using the train split)
    # We link covariates to Tenure Months and Y_0 (churn without intervention)
    cox_train_df = train_df[cox_covariates].copy()
    cox_train_df['Tenure'] = train_df['Tenure Months']
    cox_train_df['Event'] = train_df['Y_0']
    
    cph = CoxPHFitter(penalizer=0.1)
    cph.fit(cox_train_df, duration_col='Tenure', event_col='Event')
    joblib.dump(cph, os.path.join(models_dir, 'cox_survival.joblib'))
    
    # 5. Generate SHAP Explanations
    # We generate SHAP values for all customers on the Control Model (representing baseline risk explanations)
    print("Computing SHAP values for explainability...")
    explainer = shap.TreeExplainer(model_c)
    
    # Compute SHAP values for the full dataset (X_encoded) for easy serving in dashboard
    X_full = X_encoded[feature_names]
    shap_values = explainer(X_full)
    
    # Save explainer metadata and pre-computed shap values
    joblib.dump(shap_values, os.path.join(models_dir, 'shap_values.joblib'))
    
    # Save features metadata
    metadata = {
        'feature_names': feature_names,
        'cox_covariates': cox_covariates,
        'features_numeric': features_numeric,
        'features_categorical': features_categorical
    }
    joblib.dump(metadata, os.path.join(models_dir, 'features_meta.joblib'))
    
    print("Model training pipeline completed successfully!")
    print(f"Models saved to {models_dir}")

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_csv = os.path.join(base_dir, 'data', 'processed', 'telco_processed.csv')
    models_directory = os.path.join(base_dir, 'models')
    train_pipeline(data_csv, models_directory)
