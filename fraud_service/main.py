from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pickle
import numpy as np
import os

app = FastAPI(title="UPI Fraud Detection API")

# Load model globally
model_path = os.path.join(os.path.dirname(__file__), 'fraud_model.pkl')
models = None

class TransactionData(BaseModel):
    amount: float
    transaction_time: int
    location: int
    device_change: int
    transaction_frequency: int
    avg_user_spending: float
    last_transaction_gap: float

@app.on_event("startup")
def load_model():
    global models
    if os.path.exists(model_path):
        with open(model_path, 'rb') as f:
            models = pickle.load(f)
    else:
        print("Warning: fraud_model.pkl not found! Run train_model.py first.")

@app.post("/predict")
def predict_fraud(data: TransactionData):
    if not models:
        raise HTTPException(status_code=500, detail="Models not loaded")
    
    iso_forest = models['isolation_forest']
    rf_model = models['random_forest']
    
    # 1. Isolation Forest Check (Unsupervised Anomaly)
    features_iso = np.array([[
        data.amount, 
        data.transaction_time, 
        data.location, 
        data.device_change, 
        data.transaction_frequency
    ]])
    anomaly_score = iso_forest.decision_function(features_iso)[0]
    # Convert anomaly score (-0.5 to 0.5 roughly) to a 0-1 risk
    # Lower score = higher risk in Isolation Forest. Let's flip and normalize roughly.
    iso_risk = max(0, min(1, 0.5 - anomaly_score))

    # 2. Random Forest Check (Supervised Fraud Classification)
    features_rf = np.array([[
        data.amount, 
        data.transaction_time, 
        data.location, 
        data.device_change, 
        data.transaction_frequency,
        data.avg_user_spending,
        data.last_transaction_gap
    ]])
    rf_probs = rf_model.predict_proba(features_rf)[0]
    rf_risk = rf_probs[1] # Probability of being fraud (class 1)

    # Hybrid risk score
    final_risk_score = 0.6 * rf_risk + 0.4 * iso_risk
    
    # Generate reasoning
    reasons = []
    if final_risk_score > 0.4:
        if data.amount > data.avg_user_spending * 3:
            reasons.append("abnormal amount compared to average spending")
        if data.device_change == 1:
            reasons.append("new or unusual device detected")
        if data.transaction_time < 5 or data.transaction_time > 23:
            reasons.append("transaction at unusual hour")
        if data.transaction_frequency > 10:
            reasons.append("suspiciously high transaction frequency")
        if data.last_transaction_gap < 1.0:
            reasons.append("too fast consecutive transactions")

    return {
        "fraud": 1 if final_risk_score > 0.7 else 0,
        "risk_score": final_risk_score,
        "reason": " | ".join(reasons) if reasons else "Normal transaction"
    }
