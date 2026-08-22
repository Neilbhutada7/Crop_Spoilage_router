"""
Heuristic "Visual Consistency Score" -- explicitly NOT a trained
defect-detection or grading model. There is no labeled produce-defect
dataset in this project to train one on, so this module computes real,
documented pixel statistics as a coarse stand-in, and every place this
value is shown must be labeled "AI estimated visual grade (heuristic
prototype)" -- never "certified", "official", or "defect detected".

What it actually measures, honestly:
  - colour_uniformity: how consistent the hue is across the photographed
    region (circular statistics on the HSV hue channel). A tomato with one
    uniform red is more "colour-uniform" than one with green/brown patches
    -- but this does NOT distinguish natural variation from an actual
    defect; it's a texture/colour-consistency signal, nothing more.
  - dark_area_ratio: the fraction of the region notably darker than its own
    median brightness. Can correlate with visible blemishes/shadow/rot, but
    can just as easily be a shadow, a stem, or background bleeding into the
    frame -- there is no object segmentation isolating "just the crop".

No per-defect claims (rot / cracks / bruising / pesticide residue /
internal condition) are made anywhere in this module, per the project's
own rule against claiming detections the system cannot actually perform.
"""
import numpy as np
from PIL import Image

# Analyse the centre region only -- the app's own retake guidance tells the
# farmer to fill the frame with the crop and keep it centred, so the centre
# crop is a defensible (not perfect) stand-in for "the crop pixels" without
# a trained segmentation model.
CENTER_REGION_FRACTION = 0.6

# Both formulas below are simple, documented, and deliberately capped --
# NOT fitted to a validated crop-photo/grade dataset. Treat the resulting
# score as illustrative, not a calibrated measurement.
HUE_STD_FOR_MAX_PENALTY_DEG = 60.0
MAX_COLOUR_PENALTY = 40.0
DARK_RATIO_FOR_MAX_PENALTY = 0.5
MAX_DARK_PENALTY = 40.0
DARK_THRESHOLD_STD_MULTIPLIER = 0.9  # pixels this many std-devs below the
                                     # region's own median V are "dark"

GRADE_THRESHOLDS = [(75, "A"), (50, "B"), (0, "C")]


def _center_crop(image: Image.Image) -> Image.Image:
    w, h = image.size
    cw, ch = int(w * CENTER_REGION_FRACTION), int(h * CENTER_REGION_FRACTION)
    left, top = (w - cw) // 2, (h - ch) // 2
    return image.crop((left, top, left + cw, top + ch))


def _circular_hue_std_degrees(hue_channel_0_255: np.ndarray) -> float:
    # PIL's HSV hue channel is 0-255 for a 0-360 degree wheel.
    radians = hue_channel_0_255.astype(np.float64) / 255.0 * 2 * np.pi
    mean_cos, mean_sin = np.cos(radians).mean(), np.sin(radians).mean()
    resultant_length = min(1.0, np.hypot(mean_cos, mean_sin))
    if resultant_length <= 1e-6:
        return 180.0  # fully scattered hues
    circular_std_rad = np.sqrt(-2 * np.log(resultant_length))
    return float(np.degrees(circular_std_rad))


def _grade_for_score(score: float) -> str:
    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "C"


def assess_visual_grade(image: Image.Image) -> dict:
    region = _center_crop(image).convert("HSV")
    hsv = np.asarray(region, dtype=np.float64)
    hue, _sat, value = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    hue_std_deg = _circular_hue_std_degrees(hue)
    colour_penalty = min(MAX_COLOUR_PENALTY, (hue_std_deg / HUE_STD_FOR_MAX_PENALTY_DEG) * MAX_COLOUR_PENALTY)

    median_v, std_v = float(np.median(value)), float(value.std())
    dark_threshold = median_v - DARK_THRESHOLD_STD_MULTIPLIER * std_v
    dark_ratio = float((value < dark_threshold).mean()) if std_v > 0 else 0.0
    dark_penalty = min(MAX_DARK_PENALTY, (dark_ratio / DARK_RATIO_FOR_MAX_PENALTY) * MAX_DARK_PENALTY)

    score = max(0.0, min(100.0, 100.0 - colour_penalty - dark_penalty))
    grade = _grade_for_score(score)

    def level(penalty, max_penalty):
        frac = penalty / max_penalty if max_penalty else 0
        return "Low" if frac < 0.34 else "Medium" if frac < 0.67 else "High"

    return {
        "score": round(score, 1),
        "grade": grade,
        "colour_uniformity": {
            "hue_std_degrees": round(hue_std_deg, 1),
            "label": "Good" if colour_penalty < MAX_COLOUR_PENALTY * 0.34 else "Fair" if colour_penalty < MAX_COLOUR_PENALTY * 0.67 else "Uneven",
        },
        "dark_discoloured_area": {
            "ratio_pct": round(dark_ratio * 100, 1),
            "label": level(dark_penalty, MAX_DARK_PENALTY),
        },
        "methodology": (
            f"Centre {int(CENTER_REGION_FRACTION * 100)}% of the photo analysed (no object segmentation model "
            "available, so the frame centre stands in for 'the crop'). Colour uniformity = circular standard "
            "deviation of hue; discoloured-area % = share of pixels notably darker than the region's own median "
            "brightness. Score = 100 minus both penalties (each capped), mapped to a letter grade. This is a "
            "documented heuristic, not a trained defect-detection or grading model."
        ),
    }
