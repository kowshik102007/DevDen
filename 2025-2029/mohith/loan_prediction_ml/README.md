# 🏦 Loan Prediction ML Project

##  Project Description

This project is an end-to-end Machine Learning pipeline developed to predict whether a loan application should be approved or rejected based on applicant details.

The system analyzes various features such as applicant income, credit history, loan amount, and demographic information to make predictions. Multiple machine learning models are trained and compared to achieve the best performance.

The final model is deployed using a web interface, allowing users to input details and get real-time loan approval predictions.

---

##  Dataset

The dataset used for this project is the **Loan Prediction Dataset** from Kaggle.

It contains information about loan applicants, including:

* Gender
* Marital Status
* Dependents
* Education
* Self Employment
* Applicant Income
* Coapplicant Income
* Loan Amount
* Loan Amount Term
* Credit History
* Property Area
* Loan Status (Target Variable)

The target variable (`Loan_Status`) indicates:

* `Y` → Loan Approved
* `N` → Loan Rejected

---

##  Steps Involved

### 1. Data Preprocessing

* Handling missing values
* Encoding categorical variables
* Data cleaning

### 2. Exploratory Data Analysis (EDA)

* Understanding feature distributions
* Identifying important factors affecting loan approval
* Visualization using graphs

### 3. Feature Engineering

* Created new features such as:

  * Total Income
  * Income-to-Loan Ratio

### 4. Model Training

* Logistic Regression
* Decision Tree
* Random Forest

### 5. Model Evaluation

* Accuracy Score
* Precision & Recall
* Confusion Matrix

### 6. Hyperparameter Tuning

* Used GridSearchCV to improve model performance

### 7. Deployment

* Built a web application using Streamlit
* Users can input data and get predictions

---

##  Results

* The Random Forest model performed the best among all models
* Achieved an accuracy of approximately **XX%** (update after training)
* Feature engineering significantly improved model performance
* Credit History and Income were key factors influencing loan approval

---

##  Technologies Used

* Python
* Pandas & NumPy
* Scikit-learn
* Matplotlib & Seaborn
* Streamlit

---

##  Future Improvements

* Add more real-world features (credit score, employment history)
* Improve model using advanced techniques
* Deploy using cloud platforms

---