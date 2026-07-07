# 🔍 Financial Statement Anomaly Detection

An end-to-end Machine Learning project to detect fraudulent financial statements using the SEC EDGAR AAER dataset.

## 📌 Overview
This project applies classical ML techniques to identify anomalous patterns in company financial statements that may indicate accounting fraud or earnings manipulation.

## 🧠 Models Used
- **Isolation Forest** — Unsupervised anomaly detection
- **XGBoost** — Supervised classifier trained with SMOTE oversampling
- **Ensemble** — Combined anomaly scoring from both models

## 📊 Results
| Model | Fraud Recall | ROC-AUC |
|---|---|---|
| Isolation Forest | 0.21 | 0.5956 |
| XGBoost | 0.51 | 0.8394 |
| Ensemble | 0.50 | 0.8338 |

## 📁 Project Structure
\```
├── main.py            # Entry point
├── preprocessing.py   # Data loading, imputation, scaling
├── eda.py             # Exploratory data analysis plots
├── models.py          # Isolation Forest + XGBoost training
├── evaluate.py        # Metrics and confusion matrix
├── dashboard.py       # Streamlit web dashboard
└── requirements.txt   # Dependencies
\```

## 🚀 How to Run

### Install dependencies
\```bash
pip install -r requirements.txt
\```

### Download Dataset
Download `data_FraudDetection_JAR2020.csv` from [JarFraud/FraudDetection](https://github.com/JarFraud/FraudDetection) and place it in the project root.

### Run ML Pipeline
\```bash
python main.py
\```

### Launch Dashboard
\```bash
streamlit run dashboard.py
\```

## 📦 Dataset
SEC EDGAR AAER Dataset — JAR2020
146,045 company-year observations | 964 fraud cases | 43 features

## 🛠️ Tech Stack
Python, Scikit-learn, XGBoost, SMOTE, Pandas, Streamlit, Matplotlib, Seaborn

## 📝 Notes
- The dataset is not included in this repository due to its size (45MB)
- Download it separately from the JarFraud GitHub repository linked above
- Fraud cases represent only 0.66% of the dataset — a realistic real-world imbalance