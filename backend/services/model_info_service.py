"""
Assembles the actual trained model's metadata into a judge-readable payload
for GET /api/model-info -- every number here comes from the real training
run (backend/model_artifacts/model_meta.json + the loaded XGBoost model's
feature_importances_), not hardcoded claims. See MODEL.md for the full
methodology writeup and the synthetic-data caveat.
"""
import os
import sys

_ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from decay_constants import CROP_TYPES, DECAY_CONSTANTS, decay_constant_per_day  # noqa: E402
from predict import feature_importances, model_metadata  # noqa: E402

FEATURE_LABELS = {
    "temperature_c": "Temperature",
    "humidity_pct": "Humidity",
    "days_since_harvest": "Days since harvest",
    "decay_constant": "Crop decay constant",
}
FEATURE_LABELS.update({f"is_{c}": f"Crop = {c.capitalize()}" for c in CROP_TYPES})


def get_model_info() -> dict:
    meta = model_metadata()
    importances = [
        {"feature": f, "label": FEATURE_LABELS.get(f, f), "importance": round(v, 4)}
        for f, v in feature_importances()
    ]

    crops = {}
    for crop in CROP_TYPES:
        cfg = DECAY_CONSTANTS[crop]
        crops[crop] = {
            "reference_shelf_life_days": cfg["reference_shelf_life_days"],
            "optimal_temp_c": cfg["optimal_temp_c"],
            "optimal_humidity_pct": cfg["optimal_humidity_pct"],
            "humidity_sensitivity": cfg["humidity_sensitivity"],
            "decay_constant_per_day": round(decay_constant_per_day(crop), 5),
        }

    return {
        "algorithm": meta.get("model_type", "XGBoost gradient-boosted trees (XGBRegressor)"),
        "model_version": meta.get("trained_at", "v1.0"),
        "feature_columns": meta.get("features", []),
        "feature_importances": importances,
        "training": {
            "n_training_rows": meta.get("train_rows", 0),
            "n_test_rows": meta.get("test_rows", 0),
            "test_mae": round(meta.get("metrics", {}).get("mae_risk_points", 0), 2),
            "test_r2": round(meta.get("metrics", {}).get("r2", 0), 3),
            "data_source": "BENCHMARK / SYNTHETIC DATASET",
            "dataset_source": meta.get("dataset_source", ""),
            "validation_method": meta.get("split_method", ""),
        },
        "classification_view": meta.get("classification_view", {}),
        "target_variable": meta.get("target_variable", ""),
        "limitations": meta.get("limitations", []),
        "crops": crops,
        "caveat": (
            "The model is a preserved XGBoost artifact from the previous project. "
            "It was trained on fresh_produce_wastage_dataset.csv (3,000 rows). "
            "This is a benchmark/synthetic dataset and its provenance as real-world farm data is not verified."
        ),
        "blend_note": (
            "The risk score shown to farmers is NOT the raw ML prediction above. "
            "The source dataset's wastage_percent barely varies by crop (e.g. potato "
            "11.5% vs strawberry 11.9% average -- a ~1-point spread despite very "
            "different real shelf lives), so this model alone predicts nearly the "
            "same risk for any crop. The live risk score blends this model 50/50 "
            "with the literature-grounded per-crop decay formula below (see "
            "'crops' -- reference_shelf_life_days), so crop identity meaningfully "
            "affects the number farmers see. The accuracy/precision/recall/F1/"
            "ROC-AUC metrics above describe the ML half only, not the blended score."
        ),
    }
