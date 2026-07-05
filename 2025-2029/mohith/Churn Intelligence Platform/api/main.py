import os
import sys
import json
import joblib
import random
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Causal Churn Intelligence API")

# Enable CORS for frontend dashboard communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models and data
data_df = None
encoded_df = None
base_model = None
model_c = None
model_t = None
cph = None
shap_obj = None
shap_explainer = None
feature_names = None
cox_covariates = None
feature_mapping = {
    'Tenure Months': 'Tenure (Months)',
    'Monthly Charges': 'Monthly Charges ($)',
    'Total Charges': 'Total Charges ($)',
    'Contract_One year': 'Contract: One Year',
    'Contract_Two year': 'Contract: Two Years',
    'Internet Service_Fiber optic': 'Fiber Optic Internet',
    'Internet Service_No': 'No Internet Service',
    'Tech Support_Yes': 'Has Tech Support',
    'Payment Method_Credit card (automatic)': 'Payment: Credit Card (Auto)',
    'Payment Method_Electronic check': 'Payment: Electronic Check',
    'Payment Method_Mailed check': 'Payment: Mailed Check',
    'Gender_Male': 'Gender: Male',
    'Senior Citizen': 'Senior Citizen',
    'Partner_Yes': 'Has Partner',
    'Dependents_Yes': 'Has Dependents',
    'Paperless Billing_Yes': 'Paperless Billing',
    'Multiple Lines_Yes': 'Multiple Lines',
    'Online Security_Yes': 'Online Security',
    'Online Backup_Yes': 'Online Backup',
    'Device Protection_Yes': 'Device Protection',
    'Streaming TV_Yes': 'Streaming TV',
    'Streaming Movies_Yes': 'Streaming Movies',
}

@app.on_event("startup")
def startup_event():
    global data_df, encoded_df, base_model, model_c, model_t, cph, shap_obj, shap_explainer, feature_names, cox_covariates
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, 'models')
    data_path = os.path.join(base_dir, 'data', 'processed', 'telco_processed.csv')
    
    print("Loading models and data at startup...")
    # Load dataset
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Processed dataset not found at {data_path}. Please run data_prep.py first.")
    data_df = pd.read_csv(data_path)
    
    # Load test_encoded for index alignment
    test_encoded_path = os.path.join(models_dir, 'test_encoded.csv')
    train_encoded_path = os.path.join(models_dir, 'train_encoded.csv')
    
    train_encoded = pd.read_csv(train_encoded_path)
    test_encoded = pd.read_csv(test_encoded_path)
    encoded_df = pd.concat([train_encoded, test_encoded], axis=0).reset_index(drop=True)
    
    # Load models
    base_model = joblib.load(os.path.join(models_dir, 'base_classifier.joblib'))
    model_c = joblib.load(os.path.join(models_dir, 't_learner_control.joblib'))
    model_t = joblib.load(os.path.join(models_dir, 't_learner_treated.joblib'))
    cph = joblib.load(os.path.join(models_dir, 'cox_survival.joblib'))
    
    # Load SHAP and metadata
    shap_obj = joblib.load(os.path.join(models_dir, 'shap_values.joblib'))
    meta = joblib.load(os.path.join(models_dir, 'features_meta.joblib'))
    feature_names = meta['feature_names']
    cox_covariates = meta['cox_covariates']
    
    # Initialize tree explainer for on-the-fly SHAP values
    shap_explainer = shap.TreeExplainer(model_c)
    
    # Precompute model predictions on startup for instantaneous API responses
    X_full = encoded_df[feature_names]
    
    # Raw risk: P(Y=1 | W=0) from control model
    data_df['pred_risk_control'] = model_c.predict_proba(X_full)[:, 1]
    # Risk with treatment: P(Y=1 | W=1)
    data_df['pred_risk_treated'] = model_t.predict_proba(X_full)[:, 1]
    # Uplift: Risk Control - Risk Treated
    data_df['pred_uplift'] = data_df['pred_risk_control'] - data_df['pred_risk_treated']
    
    print("Startup complete. Data loaded successfully!")

# User DB path
USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users_db.json")

# In-memory store for reset codes: { email: code }
reset_codes = {}

def load_users():
    default_users = {
        "analyst@company.com": {
            "name": "Sarah Connor",
            "role": "data_scientist",
            "password": "password123",
            "token": "mock-jwt-token-analyst"
        },
        "executive@company.com": {
            "name": "John Connor",
            "role": "executive",
            "password": "password123",
            "token": "mock-jwt-token-executive"
        },
        "marketer@company.com": {
            "name": "Kyle Reese",
            "role": "retention_agent",
            "password": "password123",
            "token": "mock-jwt-token-marketer"
        }
    }
    if not os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "w") as f:
                json.dump(default_users, f, indent=4)
        except Exception as e:
            print(f"Error seeding users: {e}")
        return default_users
    try:
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading user file: {e}")
        return default_users

def save_users(users_dict):
    try:
        with open(USERS_FILE, "w") as f:
            json.dump(users_dict, f, indent=4)
    except Exception as e:
        print(f"Error saving users: {e}")

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

@app.post("/api/login")
def login(request: LoginRequest):
    email = request.email.lower().strip()
    password = request.password
    
    users = load_users()
    
    if email in users and users[email]["password"] == password:
        u = users[email]
        return {
            "email": email,
            "name": u["name"],
            "role": u["role"],
            "token": u.get("token", f"mock-jwt-token-{email.split('@')[0]}")
        }
    
    raise HTTPException(status_code=401, detail="Invalid credentials. Please verify your email and password.")

@app.post("/api/signup")
def signup(request: SignupRequest):
    name = request.name.strip()
    email = request.email.lower().strip()
    password = request.password
    role = request.role.strip()
    
    if not name or not email or not password or not role:
        raise HTTPException(status_code=400, detail="All fields are required.")
        
    if role not in ["data_scientist", "executive", "retention_agent"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")
        
    users = load_users()
    if email in users:
        raise HTTPException(status_code=400, detail="Email already registered.")
        
    users[email] = {
        "name": name,
        "role": role,
        "password": password,
        "token": f"mock-jwt-token-{email.split('@')[0]}"
    }
    save_users(users)
    
    return {
        "email": email,
        "name": name,
        "role": role,
        "token": users[email]["token"]
    }

@app.post("/api/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    email = request.email.lower().strip()
    users = load_users()
    if email not in users:
        raise HTTPException(status_code=404, detail="Email address not found in system.")
        
    # Generate 6-digit verification code
    code = f"{random.randint(100000, 999999)}"
    reset_codes[email] = code
    
    print(f"\n==========================================")
    print(f"PASSWORD RESET CODE FOR {email}: {code}")
    print(f"==========================================\n")
    
    return {
        "message": "Verification code sent to corporate email.",
        "code": code  # Returned in response for direct frontend simulation
    }

@app.post("/api/reset-password")
def reset_password(request: ResetPasswordRequest):
    email = request.email.lower().strip()
    code = request.code.strip()
    new_password = request.new_password
    
    if email not in reset_codes or reset_codes[email] != code:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")
        
    users = load_users()
    if email not in users:
        raise HTTPException(status_code=404, detail="User profile not found.")
        
    users[email]["password"] = new_password
    save_users(users)
    
    # Remove code
    if email in reset_codes:
        del reset_codes[email]
        
    return {"message": "Password successfully updated."}

class CampaignParams(BaseModel):
    cost: float = 15.0
    value: float = 150.0

@app.post("/api/metrics")
def get_metrics(params: CampaignParams):
    """
    Computes overall cohort stats and dynamic campaign ROI metrics.
    """
    global data_df
    if data_df is None:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    C = params.cost
    V = params.value
    
    # Churn rates
    control_group = data_df[data_df['W'] == 0]
    treated_group = data_df[data_df['W'] == 1]
    
    avg_churn_control = float(control_group['Y_obs'].mean())
    avg_churn_treated = float(treated_group['Y_obs'].mean())
    
    # 1. Uplift-Based Strategy
    # Target where: Expected Uplift * Value - Cost > 0
    data_df['expected_roi'] = data_df['pred_uplift'] * V - C
    uplift_targeted = data_df[data_df['expected_roi'] > 0]
    n_uplift_target = len(uplift_targeted)
    
    # Net ROI on the full dataset: sum of (true uplift * V - C) for those targeted
    # True Uplift is Y_0 - Y_1. 
    # Scaled to represent full-cohort impact:
    uplift_cost = n_uplift_target * C
    # Expected true churns avoided in targeted subpopulation
    true_avoided_uplift = float(uplift_targeted['True_Uplift'].sum())
    uplift_savings = true_avoided_uplift * V
    uplift_net_val = uplift_savings - uplift_cost
    
    # 2. Risk-Based Strategy (Compare by targeting the exact same number of customers, but sorted by risk)
    risk_sorted = data_df.sort_values(by='pred_risk_control', ascending=False)
    risk_targeted = risk_sorted.head(n_uplift_target)
    risk_cost = n_uplift_target * C
    risk_avoided_uplift = float(risk_targeted['True_Uplift'].sum())
    risk_savings = risk_avoided_uplift * V
    risk_net_val = risk_savings - risk_cost
    
    # 3. Blanket Strategy (Target everyone)
    blanket_cost = len(data_df) * C
    blanket_avoided_uplift = float(data_df['True_Uplift'].sum())
    blanket_savings = blanket_avoided_uplift * V
    blanket_net_val = blanket_savings - blanket_cost
    
    # Segment Counts
    segments = data_df['Segment'].value_counts().to_dict()
    
    return {
        "overall": {
            "total_customers": len(data_df),
            "control_churn_rate": avg_churn_control,
            "treated_churn_rate": avg_churn_treated,
            "average_uplift": float(data_df['pred_uplift'].mean()),
            "segments": segments
        },
        "campaign_roi": {
            "targeted_count": n_uplift_target,
            "targeting_percent": (n_uplift_target / len(data_df)) * 100,
            "strategies": {
                "uplift": {
                    "cost": uplift_cost,
                    "savings": uplift_savings,
                    "net_value": uplift_net_val,
                    "churns_prevented": true_avoided_uplift
                },
                "risk": {
                    "cost": risk_cost,
                    "savings": risk_savings,
                    "net_value": risk_net_val,
                    "churns_prevented": risk_avoided_uplift
                },
                "blanket": {
                    "cost": blanket_cost,
                    "savings": blanket_savings,
                    "net_value": blanket_net_val,
                    "churns_prevented": blanket_avoided_uplift
                },
                "none": {
                    "cost": 0.0,
                    "savings": 0.0,
                    "net_value": 0.0,
                    "churns_prevented": 0.0
                }
            }
        }
    }

class AddCustomerRequest(BaseModel):
    CustomerID: str
    Gender: str
    SeniorCitizen: str
    Partner: str
    Dependents: str
    TenureMonths: int
    PhoneService: str
    MultipleLines: str
    InternetService: str
    OnlineSecurity: str
    OnlineBackup: str
    DeviceProtection: str
    TechSupport: str
    StreamingTV: str
    StreamingMovies: str
    Contract: str
    PaperlessBilling: str
    PaymentMethod: str
    MonthlyCharges: float
    TotalCharges: float
    ChurnValue: int
    TreatmentW: int = 0

@app.post("/api/customers")
def add_customer(request: AddCustomerRequest):
    global data_df, encoded_df, model_c, model_t, feature_names
    if data_df is None:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    cust_id = request.CustomerID.strip()
    if not cust_id:
        raise HTTPException(status_code=400, detail="Customer ID cannot be empty.")
        
    # Check if exists
    if cust_id in data_df['CustomerID'].values:
        raise HTTPException(status_code=400, detail=f"Customer with ID '{cust_id}' already exists.")
        
    y0 = int(request.ChurnValue)
    contract = request.Contract
    monthly_charges = float(request.MonthlyCharges)
    tech_support = request.TechSupport
    tenure = int(request.TenureMonths)
    w = int(request.TreatmentW)
    
    median_charges = data_df['Monthly Charges'].median()
    
    # Simulate causal variables (Y_0, Y_1, Segment, Y_obs, True_Uplift)
    if y0 == 1:
        if contract == 'Month-to-month':
            p_persuade = 0.65
            if monthly_charges > median_charges:
                p_persuade += 0.15
            if tech_support == 'No':
                p_persuade += 0.05
        elif contract == 'One year':
            p_persuade = 0.30
        else:
            p_persuade = 0.15
        
        p_persuade = np.clip(p_persuade, 0.05, 0.90)
        is_persuaded = np.random.binomial(1, p_persuade) == 1
        if is_persuaded:
            y1 = 0
            segment = 'Persuadable'
        else:
            y1 = 1
            segment = 'Lost Cause'
    else:
        if contract == 'Month-to-month' and monthly_charges > median_charges and tenure > 12:
            p_sleeping_dog = 0.06
        elif contract == 'Month-to-month':
            p_sleeping_dog = 0.03
        else:
            p_sleeping_dog = 0.005
            
        is_sleeping_dog = np.random.binomial(1, p_sleeping_dog) == 1
        if is_sleeping_dog:
            y1 = 1
            segment = 'Sleeping Dog'
        else:
            y1 = 0
            segment = 'Sure Thing'
            
    y_obs = w * y1 + (1 - w) * y0
    true_uplift = y0 - y1
    
    # Construct raw row for data_df
    new_raw_row = {
        'CustomerID': cust_id,
        'Count': 1,
        'Country': 'United States',
        'State': 'California',
        'City': 'Los Angeles',
        'Zip Code': 90001,
        'Lat Long': '34.0522, -118.2437',
        'Latitude': 34.0522,
        'Longitude': -118.2437,
        'Gender': request.Gender,
        'Senior Citizen': request.SeniorCitizen,
        'Partner': request.Partner,
        'Dependents': request.Dependents,
        'Tenure Months': tenure,
        'Phone Service': request.PhoneService,
        'Multiple Lines': request.MultipleLines,
        'Internet Service': request.InternetService,
        'Online Security': request.OnlineSecurity,
        'Online Backup': request.OnlineBackup,
        'Device Protection': request.DeviceProtection,
        'Tech Support': request.TechSupport,
        'Streaming TV': request.StreamingTV,
        'Streaming Movies': request.StreamingMovies,
        'Contract': contract,
        'Paperless Billing': request.PaperlessBilling,
        'Payment Method': request.PaymentMethod,
        'Monthly Charges': monthly_charges,
        'Total Charges': float(request.TotalCharges),
        'Churn Label': 'Yes' if y0 == 1 else 'No',
        'Churn Value': y0,
        'Churn Score': 80 if y0 == 1 else 20,
        'CLTV': 5000.0,
        'Churn Reason': 'Competitor offered higher download speeds' if y0 == 1 else '',
        'W': w,
        'Y_0': y0,
        'Y_1': y1,
        'Segment': segment,
        'Y_obs': y_obs,
        'True_Uplift': true_uplift
    }
    
    # Dummy encode feature row
    encoded_features = {col: 0.0 for col in feature_names}
    encoded_features['Tenure Months'] = float(tenure)
    encoded_features['Monthly Charges'] = float(monthly_charges)
    encoded_features['Total Charges'] = float(request.TotalCharges)
    
    features_categorical = [
        'Gender', 'Senior Citizen', 'Partner', 'Dependents', 'Phone Service', 
        'Multiple Lines', 'Internet Service', 'Online Security', 'Online Backup', 
        'Device Protection', 'Tech Support', 'Streaming TV', 'Streaming Movies', 
        'Contract', 'Paperless Billing', 'Payment Method'
    ]
    for col in features_categorical:
        val = str(new_raw_row[col]).strip()
        dummy_col = f"{col}_{val}"
        if dummy_col in encoded_features:
            encoded_features[dummy_col] = 1.0
            
    # Model predictions
    X_row = pd.DataFrame([encoded_features])[feature_names]
    pred_risk_c = float(model_c.predict_proba(X_row)[0, 1])
    pred_risk_t = float(model_t.predict_proba(X_row)[0, 1])
    pred_uplift = pred_risk_c - pred_risk_t
    
    new_raw_row['pred_risk_control'] = pred_risk_c
    new_raw_row['pred_risk_treated'] = pred_risk_t
    new_raw_row['pred_uplift'] = pred_uplift
    
    # Append to data_df
    data_df = pd.concat([data_df, pd.DataFrame([new_raw_row])], ignore_index=True)
    
    # Save raw CSV
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(base_dir, 'data', 'processed', 'telco_processed.csv')
    data_df.to_csv(data_path, index=False)
    
    # Append to encoded_df
    new_encoded_row = encoded_features.copy()
    new_encoded_row['W'] = float(w)
    new_encoded_row['Y_obs'] = float(y_obs)
    new_encoded_row['Y_0'] = float(y0)
    new_encoded_row['Y_1'] = float(y1)
    new_encoded_row['True_Uplift'] = float(true_uplift)
    new_encoded_row['CustomerID'] = cust_id
    
    encoded_df = pd.concat([encoded_df, pd.DataFrame([new_encoded_row])], ignore_index=True)
    
    # Append to test_encoded.csv
    test_encoded_path = os.path.join(base_dir, 'models', 'test_encoded.csv')
    if os.path.exists(test_encoded_path):
        try:
            test_encoded = pd.read_csv(test_encoded_path)
            test_encoded = pd.concat([test_encoded, pd.DataFrame([new_encoded_row])], ignore_index=True)
            test_encoded.to_csv(test_encoded_path, index=False)
        except Exception as e:
            print(f"Error appending to test_encoded: {e}")
            
    return {"status": "success", "customer_id": cust_id}

@app.get("/api/customers")
def get_customers(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    segment: str = "All", # All, Target, Skip
    sort_by: str = "CustomerID", # CustomerID, churn_risk, uplift, MonthlyCharges
    sort_order: str = "asc", # asc, desc
    cost: float = 15.0,
    value: float = 150.0
):
    global data_df
    if data_df is None:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    temp_df = data_df.copy()
    
    # Calculate target flag based on parameters
    temp_df['expected_roi'] = temp_df['pred_uplift'] * value - cost
    temp_df['recommendation'] = np.where(temp_df['expected_roi'] > 0, "Target", "Skip")
    
    # Apply search filter
    if search:
        search = search.strip().lower()
        temp_df = temp_df[
            temp_df['CustomerID'].str.lower().str.contains(search) | 
            temp_df['Contract'].str.lower().str.contains(search) |
            temp_df['Payment Method'].str.lower().str.contains(search)
        ]
        
    # Apply recommendation segment filter
    if segment == "Target":
        temp_df = temp_df[temp_df['recommendation'] == "Target"]
    elif segment == "Skip":
        temp_df = temp_df[temp_df['recommendation'] == "Skip"]
        
    # Mapping sorting column
    sort_col_mapping = {
        "CustomerID": "CustomerID",
        "churn_risk": "pred_risk_control",
        "uplift": "pred_uplift",
        "MonthlyCharges": "Monthly Charges"
    }
    
    actual_sort_col = sort_col_mapping.get(sort_by, "CustomerID")
    ascending = (sort_order == "asc")
    
    temp_df = temp_df.sort_values(by=actual_sort_col, ascending=ascending)
    
    # Pagination
    total_count = len(temp_df)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    
    paginated_df = temp_df.iloc[start_idx:end_idx]
    
    customers_list = []
    for _, row in paginated_df.iterrows():
        customers_list.append({
            "id": row['CustomerID'],
            "gender": row['Gender'],
            "contract": row['Contract'],
            "monthly_charges": float(row['Monthly Charges']),
            "tenure": int(row['Tenure Months']),
            "churn_risk": float(row['pred_risk_control']),
            "uplift": float(row['pred_uplift']),
            "recommendation": row['recommendation'],
            "segment": row['Segment'] # Simulation segment
        })
        
    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "customers": customers_list
    }

@app.get("/api/customers/{customer_id}")
def get_customer_detail(customer_id: str, cost: float = 15.0, value: float = 150.0):
    global data_df, encoded_df, cph, shap_obj, feature_names, cox_covariates
    if data_df is None:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    # Find matching row in raw dataframe
    cust_rows = data_df[data_df['CustomerID'] == customer_id]
    if len(cust_rows) == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    row = cust_rows.iloc[0]
    
    # Get index in encoded_df (which is aligned with SHAP values index)
    idx = encoded_df[encoded_df['CustomerID'] == customer_id].index[0]
    
    # Extract numerical/categorical raw values for user display
    customer_info = row.to_dict()
    
    # Remove numpy values that can't be serialized easily
    clean_info = {}
    for k, v in customer_info.items():
        if isinstance(v, (np.integer, int)):
            clean_info[k] = int(v)
        elif isinstance(v, (np.floating, float)):
            clean_info[k] = float(v)
        elif pd.isna(v):
            clean_info[k] = None
        else:
            clean_info[k] = str(v)
            
    # Model predictions
    risk_control = float(row['pred_risk_control'])
    risk_treated = float(row['pred_risk_treated'])
    uplift = float(row['pred_uplift'])
    
    expected_roi = uplift * value - cost
    recommendation = "Target" if expected_roi > 0 else "Skip"
    
    # 1. Survival Curve Coordinates (Cox Proportional Hazards)
    # Get features for Cox
    cox_features_df = encoded_df.loc[[idx], cox_covariates]
    # Predict survival function: columns are index (idx), index contains times (months)
    surv_fn = cph.predict_survival_function(cox_features_df)
    
    # Convert survival curves to JSON points: [{ "month": m, "probability": p }, ...]
    # Limit to 72 months
    surv_curve = []
    for month in sorted(surv_fn.index.tolist()):
        if month <= 72:
            prob = float(surv_fn.loc[month, idx])
            surv_curve.append({"month": int(month), "probability": prob})
            
    # Calculate median survival time (where survival drops below 0.5)
    median_survival = "72+ Months"
    for pt in surv_curve:
        if pt["probability"] < 0.5:
            median_survival = f"{pt['month']} Months"
            break
            
    # 2. SHAP Drivers
    # Get shap values for this index
    # Note: shap_obj could be a SHAP Explanation or values array
    if idx < len(shap_obj.values):
        if hasattr(shap_obj, "values"):
            vals = shap_obj.values[idx]
            base_val = shap_obj.base_values[idx]
            # In shap 0.45+, base_values can be a numpy array/number
            if isinstance(base_val, np.ndarray):
                base_val = float(base_val[1]) if len(base_val.shape) > 1 else float(base_val)
            else:
                base_val = float(base_val)
        else:
            vals = shap_obj[idx]
            base_val = 0.5 # fallback
    else:
        # Compute on the fly for added customers!
        row_features = encoded_df.loc[[idx], feature_names]
        explanation = shap_explainer(row_features)
        vals = explanation.values[0]
        base_val = explanation.base_values[0]
        if isinstance(base_val, np.ndarray):
            base_val = float(base_val[1]) if len(base_val.shape) > 1 else float(base_val)
        else:
            base_val = float(base_val)
        
    drivers = []
    for i, feature in enumerate(feature_names):
        val = float(vals[i]) if hasattr(vals[i], "__len__") else float(vals[i])
        # Only report features that have non-trivial impact
        if abs(val) > 0.001:
            raw_val = encoded_df.loc[idx, feature]
            drivers.append({
                "feature_name": feature,
                "display_name": feature_mapping.get(feature, feature.replace("_", " ")),
                "shap_value": val,
                "feature_value": float(raw_val)
            })
            
    # Sort drivers by absolute value of impact
    drivers = sorted(drivers, key=lambda x: abs(x['shap_value']), reverse=True)
    
    # Split into positive (risk increasing) and negative (risk decreasing) drivers
    risk_drivers = [d for d in drivers if d['shap_value'] > 0][:5]
    retaining_drivers = [d for d in drivers if d['shap_value'] < 0][:5]
    
    # 3. Generate Plain Language Diagnostic Reason
    top_risk_feature = risk_drivers[0]['display_name'] if len(risk_drivers) > 0 else None
    top_ret_feature = retaining_drivers[0]['display_name'] if len(retaining_drivers) > 0 else None
    
    diagnostic = ""
    if risk_control > 0.5:
        diagnostic = f"This customer is at high risk of churn ({risk_control:.1%}). "
        if top_risk_feature:
            diagnostic += f"The main driver increasing their risk is {top_risk_feature}. "
    else:
        diagnostic = f"This customer has a stable profile with low churn risk ({risk_control:.1%}). "
        if top_ret_feature:
            diagnostic += f"Their loyalty is strongly supported by {top_ret_feature}. "
            
    if recommendation == "Target":
        diagnostic += f"The causal model predicts they are high-value Persuadables: offering an intervention is estimated to decrease their churn risk by {uplift:.1%} and yield a net benefit of ${expected_roi:.2f}."
    else:
        if uplift > 0.05:
            diagnostic += f"Although they respond positively to an offer (+{uplift:.1%}), the value saved does not justify the campaign cost of ${cost:.2f}."
        elif uplift < -0.01:
            diagnostic += f"Warning: They are classified as a 'Sleeping Dog'. Contacting them with a discount could remind them of high charges and increase their churn probability by {abs(uplift):.1%}. Avoid contact."
        else:
            diagnostic += "They have low responsiveness to retention offers. Wasting an intervention on them is not recommended."

    return {
        "customer_info": clean_info,
        "predictions": {
            "risk_control": risk_control,
            "risk_treated": risk_treated,
            "uplift": uplift,
            "recommendation": recommendation,
            "expected_roi": expected_roi,
            "median_survival": median_survival
        },
        "survival_curve": surv_curve,
        "explainability": {
            "base_value": base_val,
            "risk_increasing": risk_drivers,
            "risk_decreasing": retaining_drivers,
            "diagnostic": diagnostic
        }
    }

@app.get("/api/evaluation")
def get_evaluation():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_path = os.path.join(base_dir, 'models', 'evaluation_results.json')
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="Evaluation results not found. Run evaluation.py first.")
        
    with open(json_path, 'r') as f:
        data = json.load(f)
    return data

class UpdateUserRequest(BaseModel):
    current_email: str
    name: str
    role: str
    new_password: str = None

@app.post("/api/user/update")
def update_user(request: UpdateUserRequest):
    email = request.current_email.lower().strip()
    users = load_users()
    if email not in users:
        raise HTTPException(status_code=404, detail="User profile not found.")
        
    users[email]["name"] = request.name.strip()
    users[email]["role"] = request.role.strip()
    if request.new_password and request.new_password.strip():
        users[email]["password"] = request.new_password.strip()
        
    save_users(users)
    return {
        "email": email,
        "name": users[email]["name"],
        "role": users[email]["role"],
        "token": users[email].get("token", f"mock-jwt-token-{email.split('@')[0]}")
    }

@app.post("/api/system/reset")
def reset_system():
    if os.path.exists(USERS_FILE):
        try:
            os.remove(USERS_FILE)
            load_users() # Trigger regeneration of default users
            return {"message": "Database successfully reset to default demo users."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to reset DB: {str(e)}")
    return {"message": "Database already clean."}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
