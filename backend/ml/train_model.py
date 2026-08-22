"""
Trains the spoilage-risk regressor at build time and saves the artifact.
Run once (via seed_and_train.py or `python train_model.py`) -- the Flask
API loads the saved model rather than retraining per request.

See MODEL.md for feature list, training approach, and the synthetic-data
caveat.
"""
import json
import os

import joblib
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

from generate_training_data import FEATURE_COLUMNS, TARGET_COLUMN, generate

MODEL_VERSION = "xgb-v1"
ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "..", "model_artifacts")

# The trained model is a regressor (continuous 0-100 risk score), not a
# classifier -- there is no separate "spoiled/acceptable" model. This
# threshold derives a binary view from the SAME regressor's real
# predictions on the held-out test set, purely so a classification-style
# evaluation (accuracy/precision/recall/F1/ROC-AUC/confusion matrix) can be
# reported honestly, from actual model output, rather than fabricated.
SPOILED_THRESHOLD = 50.0


def _classification_view(y_test, preds) -> dict:
    y_true_bin = (y_test >= SPOILED_THRESHOLD).astype(int)
    y_pred_bin = (preds >= SPOILED_THRESHOLD).astype(int)

    # ROC-AUC uses the continuous prediction as the score, ranked against
    # the thresholded ground truth -- standard practice, and meaningful
    # even though the "positive class" itself was derived by thresholding.
    try:
        auc = roc_auc_score(y_true_bin, preds)
    except ValueError:
        auc = None  # only one class present in y_true_bin (shouldn't happen at n=1000, guarded anyway)

    cm = confusion_matrix(y_true_bin, y_pred_bin, labels=[0, 1])

    return {
        "threshold": SPOILED_THRESHOLD,
        "positive_class": "Spoiled (risk >= threshold)",
        "negative_class": "Acceptable (risk < threshold)",
        "accuracy": float(accuracy_score(y_true_bin, y_pred_bin)),
        "precision": float(precision_score(y_true_bin, y_pred_bin, zero_division=0)),
        "recall": float(recall_score(y_true_bin, y_pred_bin, zero_division=0)),
        "f1": float(f1_score(y_true_bin, y_pred_bin, zero_division=0)),
        "roc_auc": float(auc) if auc is not None else None,
        "confusion_matrix": {
            "labels": ["Acceptable", "Spoiled"],
            # rows = actual, columns = predicted
            "matrix": cm.tolist(),
        },
    }


def train(n_rows: int = 5000, seed: int = 42):
    df = generate(n_rows=n_rows, seed=seed)
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=seed
    )

    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=seed,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    classification = _classification_view(y_test.to_numpy(), preds)
    print(f"Test MAE: {mae:.2f} risk points, R2: {r2:.3f}")
    print(
        f"Classification view (threshold={SPOILED_THRESHOLD}): "
        f"accuracy={classification['accuracy']:.3f} f1={classification['f1']:.3f} "
        f"roc_auc={classification['roc_auc']:.3f}"
    )

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    model_path = os.path.join(ARTIFACT_DIR, "model.pkl")
    meta_path = os.path.join(ARTIFACT_DIR, "model_meta.json")

    joblib.dump(model, model_path)
    with open(meta_path, "w") as f:
        json.dump({
            "model_version": MODEL_VERSION,
            "feature_columns": FEATURE_COLUMNS,
            "target_column": TARGET_COLUMN,
            "n_training_rows": n_rows,
            "n_test_rows": len(X_test),
            "test_mae": mae,
            "test_r2": r2,
            "classification_view": classification,
        }, f, indent=2)

    print(f"Saved model to {model_path}")
    print(f"Saved metadata to {meta_path}")
    return model_path, meta_path


if __name__ == "__main__":
    train()
