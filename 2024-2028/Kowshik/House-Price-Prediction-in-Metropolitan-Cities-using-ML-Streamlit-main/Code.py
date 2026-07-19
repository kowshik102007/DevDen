import streamlit as st
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.cluster import KMeans

st.title("🏠 House Price Prediction in Metropolitan Areas of India")

# Load data
city_files = {
    "Bangalore": "bangalore.csv",
    "Mumbai": "mumbai.csv",
    "Delhi": "delhi.csv",
    "Chennai": "chennai.csv",
    "Hyderabad": "hyderabad.csv"
}

city_choice = st.selectbox("Select City", list(city_files.keys()))
data_path = city_files[city_choice]
df = pd.read_csv(data_path)

df.replace(9, np.nan, inplace=True)

# Features & target
feature_cols = [
    'Area', 'No. of Bedrooms', 'Resale', 'Location', 'MaintenanceStaff',
    'Gymnasium', 'SwimmingPool', 'LandscapedGardens', 'JoggingTrack',
    'RainWaterHarvesting','IndoorGames','ShoppingMall','Intercom','SportsFacility',
    'ATM','ClubHouse','School','24X7Security','PowerBackup','CarParking','StaffQuarter',
    'Cafeteria','MultipurposeRoom','Hospital','WashingMachine','Gasconnection','AC',
    'Wifi',"Children'splayarea",'LiftAvailable','BED','VaastuCompliant','Microwave',
    'GolfCourse','TV','DiningTable','Sofa','Wardrobe','Refrigerator'
]
target_col = 'Price'

# Target encoding for Location 
location_price_map = df.groupby('Location')[target_col].mean().to_dict()
df['LocationEncoded'] = df['Location'].map(location_price_map)

# KMeans clustering 
cluster_features = ['Area', 'No. of Bedrooms','LocationEncoded']
X_cluster = df[cluster_features].fillna(df[cluster_features].median())

kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
df['PropertyCluster'] = kmeans.fit_predict(X_cluster)

cluster_mapping = {0: "Budget", 1: "Mid-range", 2: "Premium", 3: "Luxury"}
df['PropertyClass'] = df['PropertyCluster'].map(cluster_mapping)

# Columns for pipeline 
numerical_cols = ['Area', 'No. of Bedrooms', 'LocationEncoded']
categorical_cols = ['Resale']
boolean_cols = [col for col in feature_cols if col not in ['Area','No. of Bedrooms','Location','Resale']]

# Transformers 
numerical_transformer = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])

categorical_transformer = Pipeline([
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('onehot', OneHotEncoder(handle_unknown='ignore'))
])

boolean_transformer = Pipeline([
    ('imputer', SimpleImputer(strategy='most_frequent'))
])

preprocessor = ColumnTransformer([
    ('num', numerical_transformer, numerical_cols),
    ('cat', categorical_transformer, categorical_cols),
    ('bool', boolean_transformer, boolean_cols)
], remainder='drop')

# Train model 
X = df[numerical_cols + categorical_cols + boolean_cols]
y = df[target_col]

model_pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('regressor', RandomForestRegressor(n_estimators=200, random_state=42))
])

model_pipeline.fit(X, y)
 
# Feature importance (top 20)
ohe = model_pipeline['preprocessor'].named_transformers_['cat']['onehot']
ohe_features = list(ohe.get_feature_names_out(categorical_cols))
all_features = numerical_cols + ohe_features + boolean_cols
importances = model_pipeline['regressor'].feature_importances_
feat_imp = pd.DataFrame({'Feature': all_features, 'Importance': importances}).sort_values(by="Importance", ascending=False)
top_features = feat_imp.head(20)['Feature'].tolist()

# Sidebar input
st.sidebar.header("Enter House Details")
area_input = st.sidebar.number_input("Area (sq.ft.)", min_value=100, max_value=10000, value=1000)
bedrooms_input = st.sidebar.number_input("No. of Bedrooms", min_value=1, max_value=10, value=2)
location_input = st.sidebar.text_input("Location", "Central")
resale_input = st.sidebar.selectbox("Resale", ["Yes", "No"])  

extra_inputs = {}
st.sidebar.subheader("Amenities")
for col in top_features:
    if col not in ['Area', 'No. of Bedrooms', 'LocationEncoded', 'Resale_1','Resale_0']:
        extra_inputs[col] = st.sidebar.checkbox(col, value=False)

# Prepare input DataFrame
input_data_dict = {
    'Area': [area_input],
    'No. of Bedrooms': [bedrooms_input],
    'Resale': [resale_input],
    'LocationEncoded': [location_price_map.get(location_input, df[target_col].mean())],
}

# Include all boolean columns, default 0 if not in top 20
for col in boolean_cols:
    if col in extra_inputs:
        input_data_dict[col] = [int(extra_inputs[col])]
    else:
        input_data_dict[col] = [0] 

input_data = pd.DataFrame(input_data_dict)

# Predict
predicted_price = model_pipeline.predict(input_data)[0]

cluster_label = kmeans.predict([[area_input, bedrooms_input,location_price_map.get(location_input, df[target_col].mean())]])[0]
property_class = cluster_mapping[cluster_label]

st.subheader(f"Predicted House Price in {city_choice}: ₹ {predicted_price:,.0f}")
st.write(f" This property is classified as: {property_class}")