"""
Synthetic training-data generator for the spoilage-risk model.

Produces rows of (crop_type, temperature_c, humidity_pct,
days_since_harvest, transit_hours, decay_constant) -> spoilage_risk_pct.

The target is computed from the deterministic decay-curve formula in
decay_constants.py plus Gaussian noise, so the relationship has real
signal for a tree-based regressor to learn (not pure random labels),
while still reflecting sensor/estimation noise a real deployment would
see. This is a synthetic dataset built for the hackathon MVP -- see
MODEL.md for the caveat about needing real historical spoilage outcomes
before production use.

transit_hours is a separate feature from days_since_harvest (rather than
folding transit time into days_since_harvest at inference) specifically
so the tree has a dedicated, densely-sampled column to split on at
hour-level resolution. days_since_harvest is sampled over a long 0-45 day
tail (most of that range irrelevant to a single truck journey), so a
transit adjustment of a few hours would fall inside one leaf if it were
merged into that column -- see destination_service.py.

visual_defect_score (0=no visible issues .. 1=severe) is likewise its own
feature. It comes from the photo analyzer's heuristic visual-consistency
score (vision/visual_grade.py), never a trained defect classifier. The
synthetic relationship encoded below -- visibly damaged/bruised produce
loses quality faster -- is a standard, well-established post-harvest
physiology assumption (mechanical damage accelerates enzymatic browning
and microbial spoilage), same caliber as the existing Q10 temperature
assumption, not a claim that this project has validated the exact
multiplier against real outcome data. Every existing caller keeps this at
its default of 0.0 (no photo analysed), so nothing about the current
risk-assessment behaviour changes unless a photo's real score is passed
in explicitly -- see risk_service.what_if_risk.
"""
import numpy as np
import pandas as pd

from decay_constants import CROP_TYPES, decay_constant_per_day, spoilage_risk_pct

BASE_FEATURE_COLUMNS = [
    "temperature_c", "humidity_pct", "days_since_harvest", "transit_hours",
    "visual_defect_score", "decay_constant",
]
CROP_FLAG_COLUMNS = [f"is_{c}" for c in CROP_TYPES]
FEATURE_COLUMNS = BASE_FEATURE_COLUMNS + CROP_FLAG_COLUMNS
TARGET_COLUMN = "spoilage_risk_pct"


def generate(n_rows: int = 5000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    crop_choices = rng.choice(CROP_TYPES, size=n_rows)
    # Indian climate range: cold-storage lows to peak-summer ambient highs.
    temperature_c = rng.uniform(5, 45, size=n_rows)
    humidity_pct = rng.uniform(30, 100, size=n_rows)
    # Skew toward fresher batches (more realistic: most routing decisions
    # happen in the first couple of weeks) with a long tail out to 45 days.
    days_since_harvest = rng.exponential(scale=6.0, size=n_rows)
    days_since_harvest = np.clip(days_since_harvest, 0, 45)
    # Realistic single-truck-journey range for the destination search
    # radius this app uses (DESTINATION_SEARCH_RADIUS_KM=250 @ ~35 km/h
    # illustrative avg speed => up to ~7h); sampled densely and uniformly
    # so the tree can resolve differences of a couple of hours.
    transit_hours = rng.uniform(0, 10, size=n_rows)
    # Densely sampled 0-1 so the tree can resolve it independently of the
    # other features, same reasoning as transit_hours above.
    visual_defect_score = rng.uniform(0, 1, size=n_rows)

    rows = []
    for crop, temp, hum, days, transit, defect in zip(
        crop_choices, temperature_c, humidity_pct, days_since_harvest, transit_hours, visual_defect_score
    ):
        k = decay_constant_per_day(crop)
        # Transit is simply more elapsed time exposed to (assumed similar)
        # ambient conditions -- same decay formula, continuous total age.
        # Visible defects accelerate that effective ageing (up to +40% at
        # the most severe score) rather than being a wholly separate risk
        # term, so the two effects compound the way real spoilage does.
        effective_days = (days + transit / 24.0) * (1.0 + 0.4 * defect)
        true_risk = spoilage_risk_pct(crop, temp, hum, effective_days)
        noisy_risk = float(np.clip(true_risk + rng.normal(0, 4.0), 0, 100))
        row = {
            "crop_type": crop,
            "temperature_c": temp,
            "humidity_pct": hum,
            "days_since_harvest": days,
            "transit_hours": transit,
            "visual_defect_score": defect,
            "decay_constant": k,
            TARGET_COLUMN: noisy_risk,
        }
        for c in CROP_TYPES:
            row[f"is_{c}"] = 1 if crop == c else 0
        rows.append(row)

    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = generate()
    out_path = "training_data.csv"
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")
