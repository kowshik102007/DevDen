import pandas as pd


def load_data(path):
    """
    Load dataset from given path
    """
    df = pd.read_csv(path)
    return df


def handle_missing_values(df):

    cat_cols = ['Gender', 'Married', 'Dependents', 'Self_Employed']

    for col in cat_cols:
        df[col] = df[col].fillna(df[col].mode()[0])

    df['LoanAmount'] = df['LoanAmount'].fillna(df['LoanAmount'].median())
    df['Loan_Amount_Term'] = df['Loan_Amount_Term'].fillna(
        df['Loan_Amount_Term'].median())
    df['Credit_History'] = df['Credit_History'].fillna(
        df['Credit_History'].mode()[0])

    return df


def encode_data(df):
    """
    Convert categorical data into numeric
    """
    df['Dependents'] = df['Dependents'].replace('3+', 3).astype(int)

    df['Gender'] = df['Gender'].map({'Male': 1, 'Female': 0})
    df['Married'] = df['Married'].map({'Yes': 1, 'No': 0})
    df['Education'] = df['Education'].map({'Graduate': 1, 'Not Graduate': 0})
    df['Self_Employed'] = df['Self_Employed'].map({'Yes': 1, 'No': 0})
    df['Property_Area'] = df['Property_Area'].map(
        {'Urban': 2, 'Semiurban': 1, 'Rural': 0})

    df['Loan_Status'] = df['Loan_Status'].map({'Y': 1, 'N': 0})

    return df


def preprocess_data(path):
    """
    Full preprocessing pipeline
    """
    df = load_data(path)
    df = handle_missing_values(df)
    df = encode_data(df)

    return df


if __name__ == "__main__":
    df = preprocess_data("data/raw/train.csv")
    print(df.head())
