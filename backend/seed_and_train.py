import pandas as pd
import numpy as np
import xgboost as xgb
import pickle
import os

MODEL_PATH = 'model.pkl'

# Approximate shelf-life/decay constants (for features)
DECAY_CONSTANTS = {
    'tomato': 0.15,
    'onion': 0.05,
    'banana': 0.20,
    'potato': 0.04,
    'lemon': 0.08,
    'mango': 0.18,
    'leafy greens': 0.25,
    'pineapple': 0.12,
    'orange': 0.07,
    'strawberry': 0.30
}

# Ensure all crops have an encoding
CROP_MAPPING = {crop: idx for idx, crop in enumerate(DECAY_CONSTANTS.keys())}

def train_model():
    dataset_file = 'fresh_produce_wastage_dataset.csv'
    if not os.path.exists(dataset_file):
        print(f"Dataset {dataset_file} not found. Cannot train.")
        return

    print(f"Loading real dataset from {dataset_file}...")
    df_real = pd.read_csv(dataset_file)
    
    # 1. Standardize Crop Name
    df_real['product_type'] = df_real['product_type'].str.lower()
    
    # Filter to only crops we know about (just to be safe)
    df_real = df_real[df_real['product_type'].isin(DECAY_CONSTANTS.keys())].copy()
    
    print(f"Training on {len(df_real)} real-world samples...")
    
    # 2. Map Columns to match our expected features
    #   'storage_temperature_celsius' -> 'temperature_c'
    #   'humidity_percent' -> 'humidity_pct'
    #   'storage_duration_hours' -> 'days_since_harvest' (divided by 24)
    #   'wastage_percent' -> 'spoilage_risk_pct'
    
    df_real['crop_encoded'] = df_real['product_type'].map(CROP_MAPPING)
    df_real['temperature_c'] = df_real['storage_temperature_celsius']
    df_real['humidity_pct'] = df_real['humidity_percent']
    df_real['days_since_harvest'] = df_real['storage_duration_hours'] / 24.0
    df_real['decay_constant'] = df_real['product_type'].map(DECAY_CONSTANTS)
    
    # Target
    df_real['spoilage_risk_pct'] = df_real['wastage_percent']
    
    # Handle any NaN values
    df_real = df_real.dropna(subset=['crop_encoded', 'temperature_c', 'humidity_pct', 'days_since_harvest', 'decay_constant', 'spoilage_risk_pct'])
    
    X = df_real[['crop_encoded', 'temperature_c', 'humidity_pct', 'days_since_harvest', 'decay_constant']]
    y = df_real['spoilage_risk_pct']
    
    print("Training XGBoost model on REAL DATA...")
    model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100, learning_rate=0.1, max_depth=5)
    model.fit(X, y)
    
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    
    print("Model successfully trained on real data and saved to model.pkl")

if __name__ == '__main__':
    train_model()
