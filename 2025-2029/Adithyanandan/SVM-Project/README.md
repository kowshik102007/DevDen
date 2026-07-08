# SVM Project - Customer Churn Prediction

This repository contains a machine learning workflow for predicting customer churn (`Exited`) using a Support Vector Machine (SVM) classifier.  
The full pipeline is implemented in the Jupyter notebook at `/home/runner/work/SVM-Project/SVM-Project/SVM.ipynb`.

## Project Overview

The notebook performs:

1. Data loading from `/home/runner/work/SVM-Project/SVM-Project/churn.csv`
2. Basic cleaning and preprocessing
3. Exploratory data analysis (EDA)
4. Model training with SVM using `GridSearchCV`
5. Model evaluation with classification metrics and plots
6. Artifact export to `/home/runner/work/SVM-Project/SVM-Project/artifacts/svm_churn_model.pkl`

## Repository Structure

```text
SVM-Project/
├── SVM.ipynb                       # End-to-end ML workflow
├── churn.csv                       # Input dataset
├── artifacts/
│   └── svm_churn_model.pkl         # Saved trained model artifact
└── README.md
```

## Tech Stack

- Python
- pandas, numpy
- scikit-learn
- matplotlib, seaborn
- joblib
- Jupyter Notebook

## Model Pipeline

The training pipeline in the notebook includes:

- Numeric preprocessing: median imputation + standard scaling
- Categorical preprocessing: mode imputation + one-hot encoding
- L2 normalization
- Feature selection via `SelectPercentile(mutual_info_classif)`
- `SVC(probability=True)` classifier
- Hyperparameter tuning using 5-fold stratified cross-validation

## How to Run

1. Create and activate a Python virtual environment.
2. Install dependencies used in the notebook (for example: `pandas`, `numpy`, `scikit-learn`, `matplotlib`, `seaborn`, `joblib`, `jupyter`).
3. Launch Jupyter:

   ```bash
   jupyter notebook
   ```

4. Open `/home/runner/work/SVM-Project/SVM-Project/SVM.ipynb` and run all cells.

## Outputs

After execution, the notebook produces:

- Tuned SVM model and best hyperparameters
- Evaluation metrics:
  - Accuracy
  - Precision
  - Recall
  - F1-score
  - ROC-AUC
- Visual diagnostics:
  - Confusion matrix
  - ROC curve
  - Precision-recall curve
- Saved artifact:
  - `/home/runner/work/SVM-Project/SVM-Project/artifacts/svm_churn_model.pkl`

## Notes

- The notebook expects the target column to be `Exited`.
- Identifier-like columns (`RowNumber`, `CustomerId`, `Surname`) are dropped before training.