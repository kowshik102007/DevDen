import pandas as pd
import numpy as np


def create_features(df):
    """
    Create advanced financial features
    """

    df['Total_Income'] = df['ApplicantIncome'] + df['CoapplicantIncome']

    df['LoanAmount_log'] = np.log(df['LoanAmount'] + 1)
    df['Total_Income_log'] = np.log(df['Total_Income'] + 1)

    df['Income_Loan_Ratio'] = df['Total_Income'] / df['LoanAmount']

    df['EMI'] = df['LoanAmount'] / df['Loan_Amount_Term']

    df['Balance_Income'] = df['Total_Income'] - df['EMI']

    return df


def drop_unnecessary_columns(df):
    """
    Drop columns not useful for model
    """
    df = df.drop(columns=['Loan_ID'])

    return df


def feature_engineering_pipeline(df):
    df = create_features(df)
    df = drop_unnecessary_columns(df)
    return df


if __name__ == "__main__":
    from data_preprocessing import preprocess_data

    df = preprocess_data("data/raw/train.csv")
    df = feature_engineering_pipeline(df)

    print(df.head())
