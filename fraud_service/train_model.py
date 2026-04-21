import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
import os

def generate_dataset(num_samples=10000):
    print(f"Generating {num_samples} transaction records...")
    np.random.seed(42)
    
    # Normal transactions: 95%
    # Fraud transactions: 5%
    num_fraud = int(num_samples * 0.05)
    num_normal = num_samples - num_fraud
    
    # Normal data
    amount_normal = np.random.uniform(10, 5000, num_normal)
    time_normal = np.random.randint(6, 23, num_normal)
    location_normal = np.random.randint(0, 100, num_normal)
    device_change_normal = np.zeros(num_normal)
    freq_normal = np.random.randint(1, 10, num_normal)
    avg_spending_normal = amount_normal * np.random.uniform(0.8, 1.2, num_normal)
    gap_normal = np.random.uniform(2.0, 72.0, num_normal)
    label_normal = np.zeros(num_normal)
    
    # Fraud data
    amount_fraud = np.random.uniform(5000, 100000, num_fraud)
    time_fraud = np.random.choice([0, 1, 2, 3, 4, 5, 23, 24], num_fraud)
    location_fraud = np.random.randint(100, 200, num_fraud) # Different locations
    device_change_fraud = np.random.choice([0, 1], num_fraud, p=[0.2, 0.8])
    freq_fraud = np.random.randint(10, 50, num_fraud)
    avg_spending_fraud = np.random.uniform(10, 500, num_fraud) # High amount, low average
    gap_fraud = np.random.uniform(0.01, 1.0, num_fraud)
    label_fraud = np.ones(num_fraud)
    
    df_normal = pd.DataFrame({
        'amount': amount_normal, 'time': time_normal, 'location': location_normal,
        'device_change': device_change_normal, 'freq': freq_normal, 
        'avg_spending': avg_spending_normal, 'gap': gap_normal, 'label': label_normal
    })
    
    df_fraud = pd.DataFrame({
        'amount': amount_fraud, 'time': time_fraud, 'location': location_fraud,
        'device_change': device_change_fraud, 'freq': freq_fraud, 
        'avg_spending': avg_spending_fraud, 'gap': gap_fraud, 'label': label_fraud
    })
    
    df = pd.concat([df_normal, df_fraud]).sample(frac=1).reset_index(drop=True)
    
    dataset_path = os.path.join(os.path.dirname(__file__), 'transactions_dataset.csv')
    df.to_csv(dataset_path, index=False)
    print(f"Dataset generated and saved to {dataset_path}")
    return df

def train_and_save_models():
    df = generate_dataset(15000)
    
    features = ['amount', 'time', 'location', 'device_change', 'freq', 'avg_spending', 'gap']
    X = df[features]
    y = df['label']
    
    print("Training Isolation Forest (Unsupervised)...")
    iso_features = ['amount', 'time', 'location', 'device_change', 'freq']
    iso_forest = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    iso_forest.fit(X[iso_features])
    
    print("Training Random Forest (Supervised)...")
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    rf_model.fit(X, y)
    
    models = {
        'isolation_forest': iso_forest,
        'random_forest': rf_model
    }
    
    model_path = os.path.join(os.path.dirname(__file__), 'fraud_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(models, f)
    
    print(f"Models saved to {model_path}")

if __name__ == "__main__":
    train_and_save_models()
