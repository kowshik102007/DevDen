import os
import numpy as np
import pandas as pd

def prep_data(input_path, output_dir):
    print(f"Loading data from {input_path}...")
    df = pd.read_excel(input_path)
    
    # 1. Clean basic columns
    df['Total Charges'] = pd.to_numeric(df['Total Charges'], errors='coerce').fillna(0.0)
    df['Churn Value'] = df['Churn Value'].astype(int)
    
    # Clean string values to make them uniform
    categorical_cols = [
        'Gender', 'Senior Citizen', 'Partner', 'Dependents', 'Phone Service', 
        'Multiple Lines', 'Internet Service', 'Online Security', 'Online Backup', 
        'Device Protection', 'Tech Support', 'Streaming TV', 'Streaming Movies', 
        'Contract', 'Paperless Billing', 'Payment Method'
    ]
    for col in categorical_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
            
    # 2. Simulate Causal Variables (Treatment W, Counterfactuals Y0, Y1, and Observed Y_obs)
    # Set seed for reproducibility
    np.random.seed(42)
    
    n_samples = len(df)
    
    # Treatment assignment W (50% randomized campaign)
    W = np.random.binomial(1, 0.5, size=n_samples)
    df['W'] = W
    
    # Control outcome Y_0 is the actual observed historical churn in the dataset
    df['Y_0'] = df['Churn Value']
    
    # Compute simulation factors for Y_1 (churn under treatment)
    # Median Monthly Charges
    median_charges = df['Monthly Charges'].median()
    
    Y_1 = []
    customer_types = []
    
    for idx, row in df.iterrows():
        y0 = row['Y_0']
        contract = row['Contract']
        monthly_charges = row['Monthly Charges']
        tech_support = row['Tech Support']
        tenure = row['Tenure Months']
        
        # We classify customers into causal categories:
        # 1. Persuadables: churn under control (Y_0=1), but stay under treatment (Y_1=0)
        # 2. Lost Causes: churn under both (Y_0=1, Y_1=1)
        # 3. Sure Things: stay under both (Y_0=0, Y_1=0)
        # 4. Sleeping Dogs: stay under control (Y_0=0), but churn under treatment (Y_1=1) due to friction
        
        if y0 == 1:
            # Customer would churn under control. Can we persuade them to stay?
            # High monthly charges & Month-to-month contracts are highly price sensitive, making them responsive to offers.
            if contract == 'Month-to-month':
                p_persuade = 0.65
                if monthly_charges > median_charges:
                    p_persuade += 0.15 # 80% persuadable
                if tech_support == 'No':
                    p_persuade += 0.05 # Lack of support was an issue, offer helps
            elif contract == 'One year':
                p_persuade = 0.30
            else: # Two year
                p_persuade = 0.15
                
            # Clip probability
            p_persuade = np.clip(p_persuade, 0.05, 0.90)
            
            # Determine if persuaded
            is_persuaded = np.random.binomial(1, p_persuade) == 1
            if is_persuaded:
                Y_1.append(0) # Retained under treatment
                customer_types.append('Persuadable')
            else:
                Y_1.append(1) # Churned anyway
                customer_types.append('Lost Cause')
                
        else:
            # Customer would stay under control. Does treatment disturb them?
            # Sleeping dogs are typically Month-to-month customers with high bills who get annoyed/reminded of their bills.
            if contract == 'Month-to-month' and monthly_charges > median_charges and tenure > 12:
                p_sleeping_dog = 0.06
            elif contract == 'Month-to-month':
                p_sleeping_dog = 0.03
            else:
                p_sleeping_dog = 0.005
                
            is_sleeping_dog = np.random.binomial(1, p_sleeping_dog) == 1
            if is_sleeping_dog:
                Y_1.append(1) # Churned under treatment (Sleeping Dog!)
                customer_types.append('Sleeping Dog')
            else:
                Y_1.append(0) # Retained under treatment (Sure Thing)
                customer_types.append('Sure Thing')
                
    df['Y_1'] = Y_1
    df['Segment'] = customer_types
    
    # Observed Outcome: W * Y_1 + (1 - W) * Y_0
    df['Y_obs'] = df['W'] * df['Y_1'] + (1 - df['W']) * df['Y_0']
    
    # Compute true individual uplift (for validation/analysis)
    # Uplift = Churn rate control - Churn rate treatment = Y_0 - Y_1
    # positive means treatment reduces churn
    df['True_Uplift'] = df['Y_0'] - df['Y_1']
    
    # 3. Save processed dataset
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'telco_processed.csv')
    df.to_csv(output_path, index=False)
    print(f"Processed dataset saved to {output_path}")
    print(f"Segments breakdown:\n{df['Segment'].value_counts()}")
    print(f"True Uplift stats:\n{df['True_Uplift'].value_counts(normalize=True)}")
    print(f"Observed Churn rate (Control): {df[df['W']==0]['Y_obs'].mean():.4f}")
    print(f"Observed Churn rate (Treated): {df[df['W']==1]['Y_obs'].mean():.4f}")

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_xlsx = os.path.join(base_dir, 'data', 'Telco_customer_churn.xlsx')
    output_directory = os.path.join(base_dir, 'data', 'processed')
    prep_data(input_xlsx, output_directory)
