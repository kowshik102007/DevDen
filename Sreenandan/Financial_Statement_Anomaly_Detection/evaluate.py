# evaluate.py
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (classification_report, roc_auc_score,
                             confusion_matrix, roc_curve)

def evaluate_models(y, iso_scores, xgb_scores):

    # Ensemble: average both scores
    ensemble_scores = (iso_scores / iso_scores.max() +
                       xgb_scores / xgb_scores.max()) / 2

    # Convert to binary predictions using 0.5 threshold
    threshold = 0.5
    iso_pred      = (iso_scores / iso_scores.max() > threshold).astype(int)
    xgb_pred      = (xgb_scores > threshold).astype(int)
    ensemble_pred = (ensemble_scores > threshold).astype(int)

    print("\n── Isolation Forest ──")
    print(classification_report(y, iso_pred, target_names=['Non-Fraud', 'Fraud']))
    print("ROC-AUC:", round(roc_auc_score(y, iso_scores), 4))

    print("\n── XGBoost ──")
    print(classification_report(y, xgb_pred, target_names=['Non-Fraud', 'Fraud']))
    print("ROC-AUC:", round(roc_auc_score(y, xgb_scores), 4))

    print("\n── Ensemble ──")
    print(classification_report(y, ensemble_pred, target_names=['Non-Fraud', 'Fraud']))
    print("ROC-AUC:", round(roc_auc_score(y, ensemble_scores), 4))

    # Confusion matrix for ensemble
    cm = confusion_matrix(y, ensemble_pred)
    plt.figure(figsize=(6, 4))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=['Non-Fraud', 'Fraud'],
                yticklabels=['Non-Fraud', 'Fraud'])
    plt.title('Ensemble Model — Confusion Matrix')
    plt.ylabel('Actual')
    plt.xlabel('Predicted')
    plt.tight_layout()
    plt.savefig('confusion_matrix.png')
    plt.close()
    print("\n✅ Confusion matrix saved.")