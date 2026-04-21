import pickle
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
import os

def generate_dummy_model():
    """
    Generates a dummy trained Isolation Forest and Random Forest
    and saves them to a pickle file for the API to use.
    """
    print("Training models with synthetic data...")
    # Synthetic data for Isolation Forest (unsupervised)
    # Features: amount, transaction_time, location, device_change, frequency
    X_unsupervised = np.random.rand(100, 5)
    iso_forest = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    iso_forest.fit(X_unsupervised)

    # Synthetic data for Random Forest (supervised)
    # Features: amount, transaction_time, location, device_change, frequency, avg_user_spending, last_transaction_gap
    X_supervised = np.random.rand(100, 7)
    y_supervised = np.random.choice([0, 1], size=100, p=[0.9, 0.1])
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_model.fit(X_supervised, y_supervised)

    models = {
        'isolation_forest': iso_forest,
        'random_forest': rf_model
    }

    # Save to file
    model_path = os.path.join(os.path.dirname(__file__), 'fraud_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(models, f)
    
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    generate_dummy_model()
