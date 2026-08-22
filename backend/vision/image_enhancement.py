"""
Real classical image enhancement -- PIL/scipy operations only, applied
conditionally based on the actual measured issues from image_quality.py.

Deliberately conservative: this brightens, sharpens edges, and denoises
using standard filters. It does NOT use any generative/AI upscaling or
detail-hallucination technique, so it can never "invent" a defect or a
clean surface that wasn't in the original photo -- see the note returned
in `applied` when severe blur makes an operation pointless.
"""
from PIL import Image, ImageEnhance, ImageFilter
from scipy import ndimage
import numpy as np

from vision.image_quality import MIN_DIMENSION_PX

MAX_UPSCALE_FACTOR = 2.0  # never upscale more than 2x -- beyond that, resized
                          # pixels stop being a meaningful stand-in for real detail


def enhance(image: Image.Image, quality: dict) -> dict:
    """Returns {"image": PIL.Image, "applied": [operation names], "note": str|None}.
    `quality` is the dict from image_quality.assess_quality() for THIS image --
    only operations relevant to the issues actually detected are applied."""
    img = image.convert("RGB")
    applied = []

    if quality["overall"] == "POOR" and "too_blurry" in quality["issues"]:
        # Severe blur: sharpening a heavily blurred photo mostly amplifies
        # noise, not real edges -- per the spec's own rule, don't pretend to
        # recover missing detail. Skip enhancement, let the caller ask for a retake.
        return {"image": img, "applied": [], "note": "severe_blur_no_enhancement"}

    if not quality["resolution"]["ok"]:
        factor = min(MAX_UPSCALE_FACTOR, MIN_DIMENSION_PX / max(1, min(img.size)))
        if factor > 1.05:
            new_size = (round(img.width * factor), round(img.height * factor))
            img = img.resize(new_size, Image.LANCZOS)
            applied.append("upscaled_for_display")

    if quality["brightness"]["label"] == "too_dark":
        img = ImageEnhance.Brightness(img).enhance(1.35)
        applied.append("brightness_correction")
    elif quality["brightness"]["label"] == "too_bright":
        img = ImageEnhance.Brightness(img).enhance(0.8)
        applied.append("brightness_correction")

    if quality["contrast"]["label"] == "low":
        img = ImageEnhance.Contrast(img).enhance(1.25)
        applied.append("contrast_enhancement")

    if quality["blur"]["label"] == "slightly_blurry":
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=110, threshold=2))
        applied.append("sharpening")

    # Mild denoise -- a 3x3 median filter per channel, standard noise
    # reduction. Only applied when brightness/contrast were already touched
    # (those corrections tend to amplify sensor noise in phone photos).
    if applied and ("brightness_correction" in applied or "contrast_enhancement" in applied):
        arr = np.asarray(img)
        denoised = np.stack([ndimage.median_filter(arr[:, :, c], size=3) for c in range(3)], axis=-1)
        img = Image.fromarray(denoised.astype("uint8"), "RGB")
        applied.append("denoising")

    return {"image": img, "applied": applied, "note": None}
