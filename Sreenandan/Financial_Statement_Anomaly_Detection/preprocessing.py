# preprocessing.py
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import RobustScaler

def load_and_preprocess(filepath):
    print("Loading dataset...")
    df = pd.read_csv(filepath)

    # Drop identifier columns
    df.drop(columns=['gvkey', 'p_aaer'], inplace=True)

    # Separate features and label
    X = df.drop(columns=['misstate'])
    y = df['misstate']

    # Impute missing values
    imputer = SimpleImputer(strategy='median')
    X_imputed = pd.DataFrame(imputer.fit_transform(X), columns=X.columns)

    # Scale features
    scaler = RobustScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X_imputed), columns=X_imputed.columns)

    print(f"✅ Preprocessing complete. Shape: {X_scaled.shape}")
    print(f"✅ Fraud cases: {y.sum()} | Non-fraud: {(y==0).sum()}")

    return X_scaled, y, X_imputed