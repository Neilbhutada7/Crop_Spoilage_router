"""
Real, classical image-quality assessment -- no trained model, no ML.

Every number here is computed directly from the actual uploaded photo's
pixels (resolution, sharpness, brightness, contrast). Nothing is invented
or estimated from a lookup table. The thresholds below are standard,
widely-used computer-vision heuristics (documented per-constant) -- they
are NOT calibrated against a validated crop-photo dataset, so they're
deliberately conservative rather than precise. See PhotoAnalyzer.md.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

# Below this on the shorter side, fine surface detail (small cracks, early
# rot spots) is unlikely to be visible regardless of anything else.
MIN_DIMENSION_PX = 400

# Variance of the Laplacian is a standard blur-detection heuristic (higher
# = sharper edges = less blur). See Pech-Pacheco et al., "Diatom
# autofocusing in brightfield microscopy: a comparative study", 2000 --
# the technique, not their specific threshold. These cutoffs are a
# reasonable general-purpose default, not fitted to crop photos
# specifically.
BLUR_VARIANCE_SHARP = 150.0
BLUR_VARIANCE_ACCEPTABLE = 60.0

# Mean 0-255 luminance.
BRIGHTNESS_TOO_DARK = 60.0
BRIGHTNESS_TOO_BRIGHT = 205.0

# Std-dev of 0-255 luminance -- a low value means a flat, washed-out image.
CONTRAST_LOW = 28.0


def _grayscale_array(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("L"), dtype=np.float64)


def assess_quality(image: Image.Image) -> dict:
    width, height = image.size
    gray = _grayscale_array(image)

    resolution_ok = min(width, height) >= MIN_DIMENSION_PX

    blur_variance = float(ndimage.laplace(gray).var())
    if blur_variance >= BLUR_VARIANCE_SHARP:
        blur_label = "sharp"
    elif blur_variance >= BLUR_VARIANCE_ACCEPTABLE:
        blur_label = "slightly_blurry"
    else:
        blur_label = "too_blurry"

    brightness = float(gray.mean())
    if brightness < BRIGHTNESS_TOO_DARK:
        brightness_label = "too_dark"
    elif brightness > BRIGHTNESS_TOO_BRIGHT:
        brightness_label = "too_bright"
    else:
        brightness_label = "ok"

    contrast = float(gray.std())
    contrast_label = "low" if contrast < CONTRAST_LOW else "ok"

    # Simple, documented penalty rule -- not a trained classifier. Each
    # issue contributes a fixed number of "poor points"; the total decides
    # the GOOD/FAIR/POOR bucket. Kept deliberately transparent so the
    # exact rule can be shown to the farmer/judges, not a black box.
    penalty = 0
    issues = []
    if blur_label == "too_blurry":
        penalty += 3
        issues.append("too_blurry")
    elif blur_label == "slightly_blurry":
        penalty += 1
        issues.append("slightly_blurry")
    if not resolution_ok:
        penalty += 2
        issues.append("low_resolution")
    if brightness_label == "too_dark":
        penalty += 1
        issues.append("too_dark")
    elif brightness_label == "too_bright":
        penalty += 1
        issues.append("too_bright")
    if contrast_label == "low":
        penalty += 1
        issues.append("low_contrast")

    if penalty >= 3:
        overall = "POOR"
    elif penalty >= 1:
        overall = "FAIR"
    else:
        overall = "GOOD"

    return {
        "overall": overall,
        "resolution": {"width": width, "height": height, "ok": resolution_ok},
        "blur": {"variance": round(blur_variance, 1), "label": blur_label},
        "brightness": {"mean": round(brightness, 1), "label": brightness_label},
        "contrast": {"std_dev": round(contrast, 1), "label": contrast_label},
        "issues": issues,
        "penalty_points": penalty,
        "methodology": (
            "Computed directly from the photo's pixels: Laplacian-variance blur score, "
            "mean/std-dev luminance for brightness and contrast, and pixel resolution. "
            "Standard classical image-processing heuristics, not a trained model."
        ),
    }
