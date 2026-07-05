import streamlit as st
import pickle
import numpy as np
import pandas as pd

model = pickle.load(open("models/model.pkl", "rb"))
scaler = pickle.load(open("models/scaler.pkl", "rb"))

st.title("🏦 Smart Loan Approval System")
st.markdown("### AI-based loan prediction using Machine Learning")

st.write("Enter applicant details below:")

gender = st.selectbox("Gender", ["Male", "Female"])
married = st.selectbox("Married", ["Yes", "No"])
dependents = st.selectbox("Dependents", [0, 1, 2, 3])
education = st.selectbox("Education", ["Graduate", "Not Graduate"])
self_employed = st.selectbox("Self Employed", ["Yes", "No"])
app_income = st.number_input("Applicant Income", min_value=0.0)
coapp_income = st.number_input("Coapplicant Income", min_value=0.0)
loan_amount = st.number_input("Loan Amount", min_value=0.0)
loan_term = st.number_input("Loan Amount Term", min_value=0.0)
credit_history = st.selectbox("Credit History", [1, 0])
property_area = st.selectbox("Property Area", ["Urban", "Semiurban", "Rural"])


def preprocess_input():
    total_income = app_income + coapp_income

    income_loan_ratio = total_income / (loan_amount + 1)
    emi = loan_amount / (loan_term + 1)
    balance_income = total_income - emi

    loan_amount_log = np.log(loan_amount + 1)
    total_income_log = np.log(total_income + 1)

    return np.array([[
        1 if gender == "Male" else 0,
        1 if married == "Yes" else 0,
        dependents,
        1 if education == "Graduate" else 0,
        1 if self_employed == "Yes" else 0,
        app_income,
        coapp_income,
        loan_amount,
        loan_term,
        credit_history,
        2 if property_area == "Urban" else (
            1 if property_area == "Semiurban" else 0),
        total_income,
        loan_amount_log,
        total_income_log,
        income_loan_ratio,
        emi,
        balance_income
    ]])


# Prediction
if st.button("Predict"):

    total_income = app_income + coapp_income

    # Validation
    if app_income <= 0:
        st.warning("Applicant income must be greater than 0")
    elif loan_amount <= 0:
        st.warning("Loan amount must be greater than 0")
    elif loan_term <= 0:
        st.warning("Loan term must be greater than 0")
    elif total_income <= 0:
        st.warning("Total income must be greater than 0")

    else:
        input_data = preprocess_input()

        input_data = scaler.transform(input_data)

        prediction = model.predict(input_data)
        prob = model.predict_proba(input_data)[0][1]

        if prediction[0] == 1:
            st.success("✅ Loan Approved")
        else:
            st.error("❌ Loan Rejected")

        if prob > 0.8:
            st.success(f"High confidence: {prob:.2f}")
        elif prob > 0.6:
            st.warning(f"Moderate confidence: {prob:.2f}")
        else:
            st.error(f"Low confidence: {prob:.2f}")

        import pandas as pd

        report = {
            "Gender": gender,
            "Married": married,
            "Dependents": dependents,
            "Education": education,
            "Self Employed": self_employed,
            "Applicant Income": app_income,
            "Coapplicant Income": coapp_income,
            "Loan Amount": loan_amount,
            "Loan Term": loan_term,
            "Credit History": credit_history,
            "Property Area": property_area,
            "Prediction": "Approved" if prediction[0] == 1 else "Rejected",
            "Confidence": round(prob, 2)
        }

        report_df = pd.DataFrame([report])
        csv = report_df.to_csv(index=False).encode('utf-8')

        st.download_button(
            label="📥 Download Report",
            data=csv,
            file_name="loan_prediction_report.csv",
            mime="text/csv"
        )
