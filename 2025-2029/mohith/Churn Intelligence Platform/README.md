# Causal Churn Intelligence Platform

Predict. Explain. Prescribe. — Beyond Standard Churn Prediction.

---

## 📌 Project Overview

Most churn-prevention projects build a classifier, predict churn risk, and stop there. This platform implements a complete decision-support system that tells you **who to target**, **why in plain English**, **what campaign offer to make**, and **how much revenue that action will yield**. 

### The Core Causal Insight
Standard risk models predict **$P(\text{Churn} \mid \text{Status Quo})$**. However, targeting customers purely based on risk scores leads to significant waste:
* **Sure Things**: Customers who stay regardless of whether they receive an offer.
* **Lost Causes**: Customers who will churn no matter what.
* **Sleeping Dogs**: Customers who are relatively stable, but sending them a marketing message irritates them (e.g., reminding them of high costs) and *increases* their likelihood of churning.
* **Persuadables (The True Targets)**: Customers who stay if they get an offer, but churn if they don't.

This platform uses **Uplift Modeling (T-Learner)** to isolate **Persuadables** and avoid **Sleeping Dogs**, optimizing campaign budgets for maximum ROI.

---

## 🧠 Technical Architecture

The platform is structured as follows:

1. **Uplift Modeling Layer**: A T-Learner meta-learner using two LightGBM models trained on treatment group (those who received an offer) and control group (those who did not) respectively to estimate individual treatment effect (ITE):
   $$\text{Uplift} = P(\text{Churn} \mid \text{Control}) - P(\text{Churn} \mid \text{Treated})$$
2. **Survival Modeling Layer**: A Cox Proportional Hazards survival model to estimate *when* a customer is expected to churn, providing a median survival time estimate.
3. **Explainability Layer**: Aligned SHAP values representing the exact risk-increasing and risk-decreasing drivers for each individual customer.
4. **Cost-Sensitive ROI Simulation**: Dynamically computes the expected profit of campaigns:
   $$\text{Expected ROI} = \text{Uplift} \times \text{LTV} - \text{Intervention Cost}$$
   Only customers with an expected ROI > 0 are recommended for targeting.

---

## 🗂️ Project Structure

* [api/](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/api): FastAPI backend server serving predictions, evaluations, and simulation calculations.
* [dashboard/](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/dashboard): React + Vite + Tailwind/CSS frontend dashboard visualizing simulation metrics and customer directories.
* [data/](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/data): Dataset files (raw Telco customer data and processed files).
* [models/](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/models): Joblib serialized models (LightGBM baseline, control and treatment models, Cox model, SHAP values).
* [src/](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/src): Core scripts containing [data_prep.py](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/src/data_prep.py), [models.py](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/src/models.py), and [evaluation.py](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/src/evaluation.py).

---

## 🚀 How to Run the Platform

### 1. Requirements & Dependencies
Ensure Python 3.9+ and Node.js are installed. The Python dependencies are detailed in [requirements.txt](file:///c:/Users/mohit/Documents/Churn%20Intelligence%20Platform/requirements.txt).

### 2. Run the FastAPI Backend
Start the backend server on port `8000`:
```bash
# From the root directory, using the local virtual environment
.\.venv\Scripts\python api/main.py
```
The server will start at `http://127.0.0.1:8000` and load precomputed models and processed dataset on startup.

### 3. Run the React Frontend Dashboard
Start the Vite dev server on port `5173`:
```bash
# Navigate to the dashboard directory and start Vite
cd dashboard
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 👤 Demo Accounts

Three mock user profiles are seeded into the platform to showcase role-based dashboards:

| Email | Password | Role | Access Type |
| :--- | :--- | :--- | :--- |
| `analyst@company.com` | `password123` | Data Scientist | Full dashboard access including Model Validation |
| `executive@company.com` | `password123` | Executive | Macro campaign simulator, summary metrics (no directory) |
| `marketer@company.com` | `password123` | Retention Agent | Customer directory and per-customer diagnostics only |
