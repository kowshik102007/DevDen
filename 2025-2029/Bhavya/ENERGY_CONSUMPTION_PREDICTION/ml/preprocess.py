import pandas as pd

RAW_DATA_PATH = "ml/data/energydata_complete.csv"
PROCESSED_DATA_PATH = "ml/data/processed_energy_data.csv"


def load_data():
    df = pd.read_csv(RAW_DATA_PATH)
    print("Dataset loaded successfully")
    print("Dataset shape:", df.shape)
    print("\nFirst 5 rows:")
    print(df.head())
    return df


def preprocess_data(df):
    
    df["date"] = pd.to_datetime(df["date"])

    
    df["hour"] = df["date"].dt.hour
    df["day"] = df["date"].dt.day
    df["month"] = df["date"].dt.month
    df["weekday"] = df["date"].dt.weekday
    df["is_weekend"] = df["weekday"].apply(lambda x: 1 if x >= 5 else 0)

    # Drop random variables because they are not useful for real prediction
    columns_to_drop = []

    if "rv1" in df.columns:
        columns_to_drop.append("rv1")

    if "rv2" in df.columns:
        columns_to_drop.append("rv2")

    df = df.drop(columns=columns_to_drop)

    # Check missing values
    print("\nMissing values:")
    print(df.isnull().sum())

    # Save cleaned data
    df.to_csv(PROCESSED_DATA_PATH, index=False)

    print("\nProcessed dataset saved successfully at:")
    print(PROCESSED_DATA_PATH)

    return df


if __name__ == "__main__":
    data = load_data()
    processed_data = preprocess_data(data)

    print("\nProcessed dataset shape:", processed_data.shape)
    print("\nFinal columns:")
    print(processed_data.columns)
