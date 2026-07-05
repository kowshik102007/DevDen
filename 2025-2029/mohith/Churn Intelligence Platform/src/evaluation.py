import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve, precision_recall_curve, auc

def evaluate_models(models_dir, output_json_path):
    print("Loading models and test dataset...")
    # Load test set
    test_df = pd.read_csv(os.path.join(models_dir, 'test_encoded.csv'))
    
    # Load metadata and models
    meta = joblib.load(os.path.join(models_dir, 'features_meta.joblib'))
    feature_names = meta['feature_names']
    
    base_model = joblib.load(os.path.join(models_dir, 'base_classifier.joblib'))
    model_c = joblib.load(os.path.join(models_dir, 't_learner_control.joblib'))
    model_t = joblib.load(os.path.join(models_dir, 't_learner_treated.joblib'))
    cph = joblib.load(os.path.join(models_dir, 'cox_survival.joblib'))
    
    X_test = test_df[feature_names]
    y_test = test_df['Y_obs']
    w_test = test_df['W']
    
    # 1. Base Classifier Evaluation (ROC and PR Curves)
    y_pred_prob = base_model.predict_proba(X_test)[:, 1]
    
    fpr, tpr, _ = roc_curve(y_test, y_pred_prob)
    roc_auc = auc(fpr, tpr)
    
    precision, recall, _ = precision_recall_curve(y_test, y_pred_prob)
    pr_auc = auc(recall, precision)
    
    # Sample curves to ~100 points for light frontend rendering
    step_roc = max(1, len(fpr) // 100)
    roc_curve_data = [{"fpr": float(fpr[i]), "tpr": float(tpr[i])} for i in range(0, len(fpr), step_roc)]
    roc_curve_data.append({"fpr": 1.0, "tpr": 1.0})
    
    step_pr = max(1, len(precision) // 100)
    pr_curve_data = [{"recall": float(recall[i]), "precision": float(precision[i])} for i in range(0, len(precision), step_pr)]
    pr_curve_data.append({"recall": 0.0, "precision": 1.0})
    
    # 2. Survival Evaluation
    # Concordance index on test set
    cox_covariates = meta['cox_covariates']
    cox_test_df = test_df[cox_covariates].copy()
    cox_test_df['Tenure'] = test_df['Tenure Months']
    cox_test_df['Event'] = test_df['Y_0']
    
    c_index = cph.score(cox_test_df, scoring_method='concordance_index')
    
    # 3. Uplift Evaluation (Qini Curve)
    # Predicted uplift = P(Y=1|W=0) - P(Y=1|W=1)
    p_c = model_c.predict_proba(X_test)[:, 1]
    p_t = model_t.predict_proba(X_test)[:, 1]
    pred_uplift = p_c - p_t
    
    test_eval = pd.DataFrame({
        'W': w_test.astype(int),
        'Y_obs': y_test.astype(int),
        'pred_uplift': pred_uplift,
        # In our simulation, we know the true outcome counterfactuals for exact comparison
        'True_Uplift': test_df['True_Uplift'].astype(int) if 'True_Uplift' in test_df else (test_df['Y_0'] - test_df['Y_1'])
    })
    
    # Sort test set by predicted uplift descending
    test_eval_sorted = test_eval.sort_values(by='pred_uplift', ascending=False).reset_index(drop=True)
    
    test_eval_sorted['is_treated'] = test_eval_sorted['W']
    test_eval_sorted['is_control'] = 1 - test_eval_sorted['W']
    
    # Cumulative stats
    test_eval_sorted['cum_n_t'] = test_eval_sorted['is_treated'].cumsum()
    test_eval_sorted['cum_n_c'] = test_eval_sorted['is_control'].cumsum()
    test_eval_sorted['cum_y_t'] = (test_eval_sorted['is_treated'] * test_eval_sorted['Y_obs']).cumsum()
    test_eval_sorted['cum_y_c'] = (test_eval_sorted['is_control'] * test_eval_sorted['Y_obs']).cumsum()
    test_eval_sorted['cum_true_uplift'] = test_eval_sorted['True_Uplift'].cumsum()
    
    n_test = len(test_eval_sorted)
    
    # Calculate model Qini curve
    qini_vals = []
    random_vals = []
    
    # Total Qini value at 100% population
    total_n_t = test_eval_sorted['is_treated'].sum()
    total_n_c = test_eval_sorted['is_control'].sum()
    total_y_t = (test_eval_sorted['is_treated'] * test_eval_sorted['Y_obs']).sum()
    total_y_c = (test_eval_sorted['is_control'] * test_eval_sorted['Y_obs']).sum()
    max_qini = total_y_c - total_y_t * (total_n_c / total_n_t) if total_n_t > 0 else 0
    
    # Sample 100 points for the curves
    points = 100
    indices = [int(i * (n_test - 1) / points) for i in range(points + 1)]
    
    qini_curve_data = []
    for step, idx in enumerate(indices):
        pct = float(step / points)
        row = test_eval_sorted.iloc[idx]
        nt = row['cum_n_t']
        nc = row['cum_n_c']
        yt = row['cum_y_t']
        yc = row['cum_y_c']
        
        # Qini formula: yc - yt * (nc / nt)
        qval = yc - yt * (nc / nt) if nt > 0 else 0.0
        rval = max_qini * pct
        
        qini_curve_data.append({
            "percentile": pct * 100,
            "model_qini": float(qval),
            "random_qini": float(rval)
        })
        
    # Calculate Area Under Qini Curve (AUQC)
    # Using trapezoidal rule
    area_model = 0.0
    area_random = 0.0
    for i in range(1, len(qini_curve_data)):
        w = (qini_curve_data[i]['percentile'] - qini_curve_data[i-1]['percentile']) / 100.0
        area_model += (qini_curve_data[i]['model_qini'] + qini_curve_data[i-1]['model_qini']) / 2.0 * w
        area_random += (qini_curve_data[i]['random_qini'] + qini_curve_data[i-1]['random_qini']) / 2.0 * w
        
    qini_coefficient = area_model - area_random
    
    # 4. ROI Simulation Curve
    # We simulate Campaign ROI at different target thresholds (0% to 100% of population sorted by predicted uplift)
    # Standard Campaign parameters:
    # Cost = $15, Customer Value = $150
    C = 15.0
    V = 150.0
    
    roi_curve_data = []
    for step, idx in enumerate(indices):
        pct = float(step / points)
        row = test_eval_sorted.iloc[idx]
        
        # Sub-population targeted: top idx customers
        targeted_count = idx + 1
        
        # Uplift strategy ROI (actual accumulated true uplift in targeted subpopulation)
        true_prevented_uplift = float(row['cum_true_uplift'])
        uplift_cost = targeted_count * C
        uplift_rev = true_prevented_uplift * V
        uplift_net_val = uplift_rev - uplift_cost
        
        # Random strategy ROI (proportional to population targeted)
        random_prevented_uplift = test_eval['True_Uplift'].sum() * pct
        random_cost = targeted_count * C
        random_rev = random_prevented_uplift * V
        random_net_val = random_rev - random_cost
        
        roi_curve_data.append({
            "percentile": pct * 100,
            "targeted_count": int(targeted_count),
            "uplift_net_val": float(uplift_net_val),
            "random_net_val": float(random_net_val)
        })
        
    # Find optimal threshold on test set
    optimal_idx = np.argmax([item['uplift_net_val'] for item in roi_curve_data])
    optimal_pct = roi_curve_data[optimal_idx]['percentile']
    optimal_val = roi_curve_data[optimal_idx]['uplift_net_val']
    
    results = {
        "metrics": {
            "roc_auc": float(roc_auc),
            "pr_auc": float(pr_auc),
            "c_index": float(c_index),
            "qini_coefficient": float(qini_coefficient),
            "optimal_target_percentile": float(optimal_pct),
            "max_campaign_net_value": float(optimal_val)
        },
        "curves": {
            "roc": roc_curve_data,
            "pr": pr_curve_data,
            "qini": qini_curve_data,
            "roi_simulation": roi_curve_data
        }
    }
    
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, 'w') as f:
        json.dump(results, f, indent=4)
        
    print(f"Evaluation results successfully saved to {output_json_path}!")
    print(f"ROC AUC: {roc_auc:.4f}")
    print(f"PR AUC: {pr_auc:.4f}")
    print(f"Survival Concordance Index: {c_index:.4f}")
    print(f"Qini Coefficient (Model - Random Area): {qini_coefficient:.4f}")
    print(f"Optimal Campaign Target Percentile: {optimal_pct:.1f}%")
    print(f"Max Campaign Net Value (Test set): ${optimal_val:.2f}")

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_directory = os.path.join(base_dir, 'models')
    output_json = os.path.join(models_directory, 'evaluation_results.json')
    evaluate_models(models_directory, output_json)
