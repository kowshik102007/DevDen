import pickle
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier


def split_data(df):
    X = df.drop('Loan_Status', axis=1)
    y = df['Loan_Status']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    return X_train, X_test, y_train, y_test, scaler


def train_models(X_train, y_train):
    models = {}

    # Logistic Regression
    lr = LogisticRegression(max_iter=2000)
    lr.fit(X_train, y_train)
    models['Logistic Regression'] = lr

    # Random Forest (BEST MODEL)
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=5,
        min_samples_split=2,
        class_weight='balanced',
        random_state=42
    )
    rf.fit(X_train, y_train)
    models['Random Forest'] = rf

    # XGBoost
    xgb = XGBClassifier(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=4,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='logloss'
    )
    xgb.fit(X_train, y_train)
    models['XGBoost'] = xgb

    return models


def save_model(model, path="models/model.pkl"):
    with open(path, "wb") as f:
        pickle.dump(model, f)


def save_scaler(scaler, path="models/scaler.pkl"):
    with open(path, "wb") as f:
        pickle.dump(scaler, f)


# 🚀 MAIN
if __name__ == "__main__":
    from data_preprocessing import preprocess_data
    from feature_engineering import feature_engineering_pipeline

    # Load data
    df = preprocess_data("data/raw/train.csv")
    df = feature_engineering_pipeline(df)

    # Split + scale
    X_train, X_test, y_train, y_test, scaler = split_data(df)

    # Train models
    models = train_models(X_train, y_train)

    print("Models trained successfully!")

    # ✅ Save BEST model
    save_model(models['Random Forest'])

    # ✅ Save scaler
    save_scaler(scaler)
