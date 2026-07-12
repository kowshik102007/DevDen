# eda.py
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

def run_eda(X_imputed, y):
    print("Running EDA...")

    # 1. Class distribution
    plt.figure(figsize=(6, 4))
    sns.countplot(x=y, hue=y, palette=['steelblue', 'crimson'], legend=False)
    plt.xticks([0, 1], ['Non-Fraud', 'Fraud'])
    plt.title('Class Distribution')
    plt.ylabel('Count')
    plt.tight_layout()
    plt.savefig('eda_class_distribution.png')
    plt.close()

    # 2. Feature distributions
    ratio_cols = ['dch_wc', 'ch_rsst', 'dch_rec', 'dch_inv', 'soft_assets', 'ch_roa']
    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    axes = axes.flatten()
    for i, col in enumerate(ratio_cols):
        temp = pd.concat([X_imputed[col], y], axis=1)
        temp.columns = [col, 'misstate']
        sns.kdeplot(data=temp[temp['misstate']==0][col], ax=axes[i],
                    label='Non-Fraud', color='steelblue', fill=True, alpha=0.4)
        sns.kdeplot(data=temp[temp['misstate']==1][col], ax=axes[i],
                    label='Fraud', color='crimson', fill=True, alpha=0.4)
        axes[i].set_title(f'Distribution: {col}')
        axes[i].legend()
        axes[i].set_xlim(-3, 3)
    plt.suptitle('Feature Distributions: Fraud vs Non-Fraud', fontsize=14)
    plt.tight_layout()
    plt.savefig('eda_feature_distributions.png')
    plt.close()

    # 3. Correlation heatmap
    plt.figure(figsize=(12, 10))
    corr = X_imputed[ratio_cols + ['reoa', 'EBIT', 'ch_fcf', 'bm', 'dpi']].corr()
    sns.heatmap(corr, annot=True, fmt='.2f', cmap='coolwarm', center=0)
    plt.title('Correlation Heatmap of Key Financial Ratios')
    plt.tight_layout()
    plt.savefig('eda_correlation_heatmap.png')
    plt.close()

    print("✅ EDA plots saved as PNG files.")