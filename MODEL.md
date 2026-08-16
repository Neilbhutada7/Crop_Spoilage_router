# Machine Learning Model Documentation

## Overview
The Spoilage Router uses an XGBoost (`GradientBoostingRegressor`) model to predict the spoilage risk of a harvested batch.

## Caveat: Synthetic Training Data
**IMPORTANT**: The current ML model is trained on a synthetic dataset generated at build time. It uses a deterministic formula with added noise to provide a real signal for the model to learn. This approach is sufficient for the MVP demo to demonstrate the integration of ML within the workflow. However, **before production use, this model MUST be retrained on real historical spoilage outcome data**. 

## Features
The model uses the following features to predict `spoilage_risk_pct`:
- `crop_type` (Tomato, Onion, Banana - encoded)
- `temperature_c` (from OpenWeatherMap or synthetic)
- `humidity_pct` (from OpenWeatherMap or synthetic)
- `days_since_harvest`
- `decay_constant` (static literature-based constant for the crop)

## Build Process
The model is trained via the `seed_and_train.py` script, which is executed when the backend container starts. The trained model is serialized to `model.pkl` and loaded into the Flask API memory once, preventing the need to retrain on every API request.
