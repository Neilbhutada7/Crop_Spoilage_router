import pandas as pd
import numpy as np
import xgboost as xgb
import pickle
import os
import json
from datetime import datetime, timezone
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)

MODEL_PATH = 'model.pkl'
METRICS_PATH = 'model_metrics.json'
MIN_TEST_ROWS_FOR_VALID_METRICS = 100

# The 0-100 "Risk Score Index" shown throughout the app (app.py's
# predict_risk_score) is wastage_pct scaled by 100/30, because observed
# wastage_percent in the source data rarely exceeds ~30%. The classification
# view below operates on that SAME rescaled 0-100 index, not on raw
# wastage_percent -- a >=50 threshold only makes sense on that scale (raw
# wastage_percent tops out around 29%, so a raw >=50 threshold would have
# zero positive cases in this dataset and produce degenerate metrics).
RISK_INDEX_SCALE = 100.0 / 30.0
HIGH_RISK_INDEX_THRESHOLD = 50.0

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

def crop_column_name(crop):
    return f"is_{crop.replace(' ', '_')}"

# One binary column per crop, in a fixed order shared with app.py's
# inference-time feature construction (predict_risk_score). Order matters:
# it must match exactly between training and inference, or predictions
# will silently use the wrong crop's one-hot flag.
CROP_ONE_HOT_COLUMNS = [crop_column_name(c) for c in DECAY_CONSTANTS.keys()]

def train_model():
    dataset_file = 'fresh_produce_wastage_dataset.csv'
    if not os.path.exists(dataset_file):
        print(f"Dataset {dataset_file} not found. Cannot train.")
        return

    print(f"Loading dataset from {dataset_file}...")
    df_raw = pd.read_csv(dataset_file)
    total_rows = len(df_raw)

    # 1. Standardize Crop Name
    df_real = df_raw.copy()
    df_real['product_type'] = df_real['product_type'].str.lower()

    # Filter to only crops we know about (just to be safe)
    df_real = df_real[df_real['product_type'].isin(DECAY_CONSTANTS.keys())].copy()

    # 2. Map Columns to match our expected features
    #   'storage_temperature_celsius' -> 'temperature_c'
    #   'storage_duration_hours' -> 'days_since_harvest' (divided by 24)
    #   'wastage_percent' -> 'spoilage_risk_pct'
    df_real['temperature_c'] = df_real['storage_temperature_celsius']
    df_real['days_since_harvest'] = df_real['storage_duration_hours'] / 24.0
    df_real['decay_constant'] = df_real['product_type'].map(DECAY_CONSTANTS)
    df_real['spoilage_risk_pct'] = df_real['wastage_percent']

    # One-hot crop encoding. XGBoost would otherwise treat a single integer
    # crop_encoded column as an ordered numeric feature (implying e.g.
    # "onion > tomato"), which is meaningless for an unordered category.
    for crop, col in zip(DECAY_CONSTANTS.keys(), CROP_ONE_HOT_COLUMNS):
        df_real[col] = (df_real['product_type'] == crop).astype(int)

    # humidity_percent (-> humidity_pct) was tested as a model feature and
    # dropped: it correlates with the target at r=-0.01 (pure noise here),
    # and an XGBRegressor trained WITHOUT it scores higher on held-out test
    # data (R2=0.32 vs 0.30 with it) than one trained with it OR with a
    # derived dew-point feature in its place (R2=0.30, no better -- 88%
    # correlated with temperature_c, so it added no real new signal). See
    # MODEL.md "Feature selection: why humidity_pct was dropped" for the
    # full experiment. It's therefore not in required_cols below, which
    # also means rows with a missing humidity_percent (248 of 3000) are no
    # longer discarded for a column the model doesn't use.
    required_cols = CROP_ONE_HOT_COLUMNS + ['temperature_c', 'days_since_harvest', 'decay_constant', 'spoilage_risk_pct']
    df_real = df_real.dropna(subset=required_cols)
    rows_after_cleaning = len(df_real)

    print(f"Training on {rows_after_cleaning} samples (of {total_rows} total rows; see model_metrics.json for dataset provenance notes)...")

    feature_cols = CROP_ONE_HOT_COLUMNS + ['temperature_c', 'days_since_harvest', 'decay_constant']
    X = df_real[feature_cols]
    y = df_real['spoilage_risk_pct']

    # Held-out test split so reported metrics reflect unseen data, not training fit.
    # Each row is one independent batch (no repeated batch_id), so a random split
    # does not leak the same batch across train/test.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Monotone constraints: predicted risk must never decrease as
    # days_since_harvest or temperature_c increases, all else equal. Domain
    # knowledge (spoilage is not reversible; heat accelerates it -- the
    # standard Q10 assumption already used elsewhere in this project's
    # decay-constant reasoning) is more reliable here than letting noisy
    # 2,700-odd rows of data pick an unconstrained tree structure. Without
    # this, either feature can show a locally non-monotonic (even
    # decreasing) relationship near the edges of the observed range --
    # found via manual testing of the AI assistant's "what if it were
    # hotter" answer, which had been reporting risk going DOWN with heat.
    # Order matches feature_cols: [<one-hot crop columns>, temperature_c, days_since_harvest, decay_constant]
    monotone_constraints = tuple([0] * len(CROP_ONE_HOT_COLUMNS) + [1, 1, 0])

    print(f"Training XGBoost on {len(X_train)} rows, validating on {len(X_test)} held-out rows...")
    model = xgb.XGBRegressor(
        objective='reg:squarederror', n_estimators=100, learning_rate=0.1, max_depth=5,
        monotone_constraints=monotone_constraints
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(mean_squared_error(y_test, y_pred) ** 0.5)
    r2 = float(r2_score(y_test, y_pred))

    # Classification view: threshold the SAME held-out regression predictions
    # (not a separately trained classifier) at HIGH_RISK_INDEX_THRESHOLD on
    # the 0-100 Risk Score Index scale used throughout the app.
    y_test_index = np.clip(y_test.to_numpy() * RISK_INDEX_SCALE, 0, 100)
    y_pred_index = np.clip(y_pred * RISK_INDEX_SCALE, 0, 100)
    y_test_binary = (y_test_index >= HIGH_RISK_INDEX_THRESHOLD).astype(int)
    y_pred_binary = (y_pred_index >= HIGH_RISK_INDEX_THRESHOLD).astype(int)

    n_positive = int(y_test_binary.sum())
    n_negative = int(len(y_test_binary) - n_positive)
    classification_view = None
    if n_positive > 0 and n_negative > 0:
        classification_view = {
            "risk_index_threshold": HIGH_RISK_INDEX_THRESHOLD,
            "positive_class": f"Risk Score Index >= {HIGH_RISK_INDEX_THRESHOLD:.0f} (High risk)",
            "negative_class": f"Risk Score Index < {HIGH_RISK_INDEX_THRESHOLD:.0f}",
            "n_test_positive": n_positive,
            "n_test_negative": n_negative,
            "accuracy": round(float(accuracy_score(y_test_binary, y_pred_binary)), 4),
            "precision": round(float(precision_score(y_test_binary, y_pred_binary, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test_binary, y_pred_binary, zero_division=0)), 4),
            "f1": round(float(f1_score(y_test_binary, y_pred_binary, zero_division=0)), 4),
            "roc_auc": round(float(roc_auc_score(y_test_binary, y_pred_index)), 4)
        }
    else:
        classification_view = {
            "status": f"Degenerate at threshold {HIGH_RISK_INDEX_THRESHOLD:.0f}: {n_positive} positive / {n_negative} negative test rows -- classification metrics not meaningful."
        }

    # Refit on the full dataset for the model actually served in production,
    # now that metrics have already been captured on the untouched test split.
    final_model = xgb.XGBRegressor(
        objective='reg:squarederror', n_estimators=100, learning_rate=0.1, max_depth=5,
        monotone_constraints=monotone_constraints
    )
    final_model.fit(X, y)

    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(final_model, f)

    metrics = {
        "status": "validated" if len(X_test) >= MIN_TEST_ROWS_FOR_VALID_METRICS else "insufficient_validation_data",
        "target_variable": "wastage_percent (percentage of batch quantity lost to spoilage before sale)",
        "model_type": "XGBoost gradient-boosted trees (XGBRegressor)",
        "features": feature_cols,
        "feature_selection_notes": "humidity_pct was tested as a feature and dropped: r=-0.01 with the target (essentially no linear relationship), and a held-out comparison showed a model WITHOUT it outperforming one with it (R2 0.32 vs 0.30) as well as one using a derived dew-point feature in its place (R2 0.30, no improvement -- 88% correlated with temperature_c). Dropping it also let 248 rows with missing humidity_percent (previously excluded) re-enter training.",
        "crop_encoding": "one-hot (one binary is_<crop> column per crop) -- not an ordinal integer, since crop categories have no numeric order",
        "crop_types": sorted(df_real['product_type'].unique().tolist()),
        "dataset_source": "fresh_produce_wastage_dataset.csv (public benchmark dataset bundled with this repo; provenance as real-world observed farm/warehouse outcomes has not been independently verified by this team)",
        "dataset_size_total_rows": total_rows,
        "dataset_size_after_cleaning": rows_after_cleaning,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "split_method": "random 80/20 holdout, random_state=42 (one row = one independent batch, no repeated batch_id in source data)",
        "metrics": {
            "mae_risk_points": round(mae, 3),
            "rmse_risk_points": round(rmse, 3),
            "r2": round(r2, 4)
        },
        "classification_view": classification_view,
        "limitations": [
            "Source dataset covers storage_duration_hours up to 96 hours (4 days) only; risk scores beyond that are extrapolated in the API using a linear scaling heuristic, not learned by the model.",
            "Dataset provenance is not independently verified as real-world observed spoilage outcomes; treat as a benchmark/demonstration dataset until confirmed.",
            "No pilot (real farmer) outcome data has been incorporated yet.",
            "Model is retrained on the full dataset after metrics capture, so served predictions come from a model that has seen all rows; only the metrics above come from a held-out split.",
            "The classification view is a threshold applied to this same regressor's held-out predictions, not a separately trained/validated classifier."
        ],
        "trained_at": datetime.now(timezone.utc).isoformat()
    }

    with open(METRICS_PATH, 'w') as f:
        json.dump(metrics, f, indent=2)

    print(f"Test R2={r2:.4f}  MAE={mae:.2f}  RMSE={rmse:.2f}")
    if "status" in classification_view:
        print(f"Classification view: {classification_view['status']}")
    else:
        cv = classification_view
        print(f"Classification view (threshold={cv['risk_index_threshold']:.0f} on 0-100 Risk Score Index, "
              f"{cv['n_test_positive']} positive / {cv['n_test_negative']} negative test rows):")
        print(f"  Accuracy={cv['accuracy']:.4f}  Precision={cv['precision']:.4f}  Recall={cv['recall']:.4f}  "
              f"F1={cv['f1']:.4f}  ROC-AUC={cv['roc_auc']:.4f}")
    print(f"Model saved to {MODEL_PATH}, metrics saved to {METRICS_PATH}")

if __name__ == '__main__':
    train_model()
