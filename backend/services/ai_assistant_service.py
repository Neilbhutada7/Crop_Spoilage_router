"""
Crop AI Assistant: answers questions about crop spoilage, shelf life,
storage conditions, and planting recommendations, in English, Hindi or
Marathi.

This is a rule-based / intent-matching assistant grounded entirely in our
own decay_constants.py data and the current weather for a location -- NOT
a general-purpose LLM. It is scoped deliberately: every answer traces back
to a number already used elsewhere in the app (the same decay constants
behind the risk model), so what it says is always consistent with what the
rest of the UI shows. Out-of-scope questions get an honest "here's what I
can help with" rather than a hallucinated answer. Hindi/Marathi support is
a fixed set of parallel templates (not a live translation service), so it
covers the same fixed question types as English, not open-ended phrasing.
"""
import datetime
import os
import sys

_ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from decay_constants import (  # noqa: E402
    CROP_TYPES,
    DECAY_CONSTANTS,
    decay_constant_per_day,
    humidity_multiplier,
    temperature_multiplier,
)

from services.gpt_tools import (  # noqa: E402
    get_best_destination,
    get_candidate_markets,
    get_current_batch,
    predict_spoilage,
    what_if,
)
from services.weather_service import get_weather  # noqa: E402

SUPPORTED_LANGS = ("en", "hi", "mr")

# Illustrative bump used to answer "what if temperature increases" without
# the farmer specifying an exact number -- stated explicitly in the answer
# itself, and the risk/value numbers that follow are a real what_if() model
# call, not invented.
TEMP_WHATIF_DELTA_C = 5.0

_RISK_LABEL_TEXT = {
    "en": {"Low": "low", "Medium": "medium", "High": "high"},
    "hi": {"Low": "कम", "Medium": "मध्यम", "High": "ज्यादा"},
    "mr": {"Low": "कमी", "Medium": "मध्यम", "High": "जास्त"},
}

CROP_NAMES = {
    "hi": {
        "tomato": "टमाटर", "onion": "प्याज", "banana": "केला",
        "potato": "आलू", "mango": "आम", "chili": "मिर्च",
    },
    "mr": {
        "tomato": "टोमॅटो", "onion": "कांदा", "banana": "केळी",
        "potato": "बटाटा", "mango": "आंबा", "chili": "मिरची",
    },
}
CROP_NAMES_REVERSE = {
    lang: {v: k for k, v in names.items()} for lang, names in CROP_NAMES.items()
}

INTENT_KEYWORDS = {
    "en": {
        # Batch-context intents (need a selected batch; checked first --
        # see _find_crop note below on why "hi"/"hey" were removed).
        "action_advice": ("what should i do", "what to do", "what now"),
        "risk_explain": ("why is the risk", "why risk", "risk high", "why is my risk", "explain the risk", "explain risk"),
        "market_explain": ("why did you choose", "why this market", "why market", "why not", "why pune", "why is this market"),
        "best_price": ("more money", "better earnings", "higher price", "which market", "better market", "best price", "highest price"),
        "temp_whatif": ("temperature increase", "if temperature", "temperature rise", "hotter", "gets hot"),
        "reduce_loss": ("reduce spoilage", "reduce loss", "prevent spoilage", "reduce crop loss", "avoid spoilage"),
        # General crop-info intents (no batch needed).
        "plant": ("plant", "grow", "sow", "which crop", "what crop", "best crop"),
        "shelf_life": ("shelf life", "how long", "last", "keep"),
        "spoilage": ("spoil", "decay", "rot", "rate", "fast"),
        "storage": ("store", "storage", "condition", "temperature", "humidity"),
        # "hi"/"hey" deliberately excluded -- as short substrings they false-
        # matched inside ordinary words ("this", "they", "high", "history"),
        # swallowing real questions into the generic help text.
        "greeting": ("hello", "help", "what can you"),
    },
    "hi": {
        "action_advice": ("क्या करना चाहिए", "अभी क्या करूं", "क्या करूं"),
        "risk_explain": ("खतरा ज्यादा", "खतरा क्यों", "जोखिम क्यों"),
        "market_explain": ("बाजार क्यों", "यह बाजार", "यह मंडी"),
        "best_price": ("ज्यादा कमाई", "ज्यादा पैसा", "बेहतर भाव", "कौन सा बाजार"),
        "temp_whatif": ("तापमान बढ़", "गर्मी बढ़"),
        "reduce_loss": ("नुकसान कम", "खराब होने से कैसे बचाएं", "खराब होने से कैसे बचाएँ", "कैसे बचाएं"),
        "plant": ("लगाना", "बोना", "कौन सी फसल", "बेहतर फसल", "क्या लगाएं"),
        "shelf_life": ("शेल्फ लाइफ", "कितने दिन", "कब तक", "टिकता"),
        "spoilage": ("खराब", "सड़", "जल्दी"),
        "storage": ("रखें", "भंडारण", "स्टोर", "तापमान", "नमी"),
        "greeting": ("नमस्ते", "हेलो", "मदद"),
    },
    "mr": {
        "action_advice": ("काय करावे", "आता काय करू", "काय करू"),
        "risk_explain": ("धोका जास्त", "धोका का"),
        "market_explain": ("बाजारपेठ का", "ही बाजारपेठ", "ही मंडई"),
        "best_price": ("जास्त कमाई", "जास्त पैसे", "चांगला भाव", "कोणती बाजारपेठ"),
        "temp_whatif": ("तापमान वाढ", "उष्णता वाढ"),
        "reduce_loss": ("नुकसान कमी", "खराब होण्यापासून कसे वाचवावे", "कसे वाचवावे"),
        "plant": ("लावणे", "पेरणे", "कोणते पीक", "चांगले पीक", "काय लावावे"),
        "shelf_life": ("शेल्फ लाइफ", "किती दिवस", "कधीपर्यंत", "टिकते"),
        "spoilage": ("खराब", "कुजणे", "लवकर"),
        "storage": ("ठेवा", "साठवणूक", "स्टोअर", "तापमान", "आर्द्रता"),
        "greeting": ("नमस्कार", "हॅलो", "मदत"),
    },
}


def _help_text(lang: str) -> str:
    crop_list = ", ".join(_crop_label(c, lang) for c in CROP_TYPES)
    if lang == "hi":
        return (
            "मैं इनमें मदद कर सकता हूं: फसल की शेल्फ लाइफ (\"टमाटर कितने दिन चलता है\"), "
            "खराब होने की दर (\"केला कितनी जल्दी खराब होता है\"), भंडारण की स्थिति "
            "(\"प्याज को कैसे रखें\"), और मौसम के अनुसार कौन सी फसल सही है "
            f"(\"अभी क्या लगाना चाहिए\")। समर्थित फसलें: {crop_list}।"
        )
    if lang == "mr":
        return (
            "मी यामध्ये मदत करू शकतो: पिकाचे शेल्फ लाइफ (\"टोमॅटो किती दिवस टिकतो\"), "
            "खराब होण्याचा वेग (\"केळी किती लवकर खराब होते\"), साठवणुकीची पद्धत "
            "(\"कांदा कसा साठवावा\"), आणि हवामानानुसार कोणते पीक योग्य आहे "
            f"(\"आता काय लावावे\"). समर्थित पिके: {crop_list}."
        )
    return (
        "I can answer questions about: crop shelf life (\"how long does tomato last\"), "
        "spoilage/decay rate (\"how fast does banana spoil\"), ideal storage conditions "
        "(\"how should I store onion\"), and which crop suits current weather best "
        f"(\"what should I plant now\"). Supported crops: {crop_list}."
    )


def _find_crop(question: str, lang: str):
    q = question.lower()
    for crop in CROP_TYPES:
        if crop in q:
            return crop
    for name, crop in CROP_NAMES_REVERSE.get(lang, {}).items():
        if name in question:
            return crop
    return None


def _crop_label(crop: str, lang: str) -> str:
    return CROP_NAMES.get(lang, {}).get(crop, crop.capitalize())


def _shelf_life_answer(crop: str, lang: str) -> str:
    cfg = DECAY_CONSTANTS[crop]
    name = _crop_label(crop, lang)
    if lang == "hi":
        return (
            f"{name} की आदर्श भंडारण स्थिति ({cfg['optimal_temp_c']}°C, {cfg['optimal_humidity_pct']}% नमी) "
            f"में शेल्फ लाइफ लगभग {cfg['reference_shelf_life_days']} दिन है। इससे अधिक तापमान पर यह जल्दी "
            f"खराब होता है — हर 10°C अधिक तापमान पर खराब होने की गति लगभग दोगुनी हो जाती है।"
        )
    if lang == "mr":
        return (
            f"{name} चे आदर्श साठवणूक स्थितीत ({cfg['optimal_temp_c']}°C, {cfg['optimal_humidity_pct']}% आर्द्रता) "
            f"शेल्फ लाइफ सुमारे {cfg['reference_shelf_life_days']} दिवस आहे. यापेक्षा जास्त तापमानात ते लवकर "
            f"खराब होते — प्रत्येक 10°C जास्त तापमानाला खराब होण्याचा वेग साधारण दुप्पट होतो."
        )
    return (
        f"{name} has a reference shelf life of about "
        f"{cfg['reference_shelf_life_days']} days when held at its ideal storage "
        f"conditions ({cfg['optimal_temp_c']}°C, {cfg['optimal_humidity_pct']}% humidity). "
        f"Outside those conditions it spoils faster -- every 10°C above ideal roughly "
        f"doubles the decay rate."
    )


def _spoilage_rate_answer(crop: str, lang: str) -> str:
    k = decay_constant_per_day(crop)
    cfg = DECAY_CONSTANTS[crop]
    name = _crop_label(crop, lang)
    if lang == "hi":
        return (
            f"{name} की आधार क्षय दर आदर्श परिस्थितियों में {k:.4f} प्रति दिन है। यह नमी के प्रति "
            f"अधिक संवेदनशील है — आदर्श {cfg['optimal_humidity_pct']}% नमी से हर 100% विचलन पर "
            f"{cfg['humidity_sensitivity']}× गुणक लागू होता है।"
        )
    if lang == "mr":
        return (
            f"{name} चा आधार क्षय दर आदर्श परिस्थितीत दर दिवशी {k:.4f} आहे. हे आर्द्रतेसाठी "
            f"जास्त संवेदनशील आहे — आदर्श {cfg['optimal_humidity_pct']}% आर्द्रतेपासून प्रत्येक 100% फरकाला "
            f"{cfg['humidity_sensitivity']}× गुणक लागू होतो."
        )
    return (
        f"{name}'s base decay constant is {k:.4f} per day at ideal storage "
        f"conditions -- meaning about {round((1 - pow(2.718281828, -k)) * 100, 1)}% of "
        f"remaining quality is lost per day even under good conditions. It's more "
        f"humidity-sensitive than most: a {cfg['humidity_sensitivity']}× multiplier applies "
        f"per 100% deviation from its ideal {cfg['optimal_humidity_pct']}% humidity."
    )


def _storage_answer(crop: str, lang: str) -> str:
    cfg = DECAY_CONSTANTS[crop]
    name = _crop_label(crop, lang)
    if lang == "hi":
        return (
            f"{name} को लगभग {cfg['optimal_temp_c']}°C तापमान और {cfg['optimal_humidity_pct']}% "
            f"सापेक्ष आर्द्रता पर रखें ताकि खराब होने की गति सबसे धीमी रहे। इन स्थितियों में शेल्फ लाइफ "
            f"लगभग {cfg['reference_shelf_life_days']} दिन है।"
        )
    if lang == "mr":
        return (
            f"{name} सुमारे {cfg['optimal_temp_c']}°C तापमानात आणि {cfg['optimal_humidity_pct']}% "
            f"सापेक्ष आर्द्रतेत ठेवा म्हणजे खराब होण्याचा वेग सर्वात कमी राहील. या स्थितीत शेल्फ लाइफ "
            f"सुमारे {cfg['reference_shelf_life_days']} दिवस आहे."
        )
    return (
        f"Store {name} at around {cfg['optimal_temp_c']}°C and "
        f"{cfg['optimal_humidity_pct']}% relative humidity for the slowest spoilage. "
        f"Reference shelf life at those conditions is ~{cfg['reference_shelf_life_days']} days."
    )


def _planting_answer(lat: float | None, lon: float | None, lang: str) -> str:
    if lat is None or lon is None:
        crops_by_temp = sorted(CROP_TYPES, key=lambda c: DECAY_CONSTANTS[c]["optimal_temp_c"])
        names = ", ".join(_crop_label(c, lang) for c in crops_by_temp)
        if lang == "hi":
            return (
                f"पहले खेत का स्थान चुनें ताकि मैं वहां का मौसम देख सकूं। सामान्यतः {names} — यहां "
                f"सबसे ठंडे से सबसे गर्म आदर्श भंडारण तापमान के क्रम में हैं।"
            )
        if lang == "mr":
            return (
                f"आधी शेताचे ठिकाण निवडा म्हणजे मला तिथले हवामान तपासता येईल. साधारणपणे {names} — हे "
                f"सर्वात थंड ते सर्वात उष्ण आदर्श साठवणूक तापमानाच्या क्रमाने आहेत."
            )
        return (
            "Pick a farm location first so I can check current weather there. In general, "
            + names
            + " are ordered here from coolest to warmest ideal storage temperature, which "
            "roughly tracks which season each suits best."
        )

    weather = get_weather(lat, lon, datetime.date.today())
    temp, hum = weather["temperature_c"], weather["humidity_pct"]

    scored = []
    for crop in CROP_TYPES:
        t_mult = temperature_multiplier(crop, temp)
        h_mult = humidity_multiplier(crop, hum)
        scored.append((crop, t_mult * h_mult))
    scored.sort(key=lambda x: x[1])
    best_crop, best_mult = scored[0]
    best_name = _crop_label(best_crop, lang)

    if lang == "hi":
        live_word = "वास्तविक" if not weather["is_synthetic"] else "सिंथेटिक"
        return (
            f"इस स्थान पर वर्तमान स्थिति {temp}°C और {hum}% नमी है ({live_word} मौसम डेटा)। इस ऐप "
            f"द्वारा समर्थित फसलों में से, {best_name} भंडारण के लिए अभी सबसे उपयुक्त है (आदर्श "
            f"स्थितियों के सबसे करीब, आधार क्षय दर से लगभग {round((best_mult - 1) * 100)}% अधिक)। "
            f"यह हमारे क्षय मॉडल पर आधारित भंडारण उपयुक्तता है, पूर्ण कृषि रोपण सलाह नहीं।"
        )
    if lang == "mr":
        live_word = "खरे" if not weather["is_synthetic"] else "सिंथेटिक"
        return (
            f"या ठिकाणी सध्याची स्थिती {temp}°C आणि {hum}% आर्द्रता आहे ({live_word} हवामान डेटा). या अ‍ॅपने "
            f"समर्थित पिकांपैकी, {best_name} साठवणुकीसाठी सध्या सर्वात योग्य आहे (आदर्श "
            f"स्थितीच्या सर्वात जवळ, आधार क्षय दरापेक्षा सुमारे {round((best_mult - 1) * 100)}% जास्त). "
            f"हे आमच्या क्षय मॉडेलवर आधारित साठवणूक योग्यता आहे, संपूर्ण कृषी लागवड सल्ला नाही."
        )
    return (
        f"Current conditions at this location are {temp}°C and {hum}% humidity "
        f"({'live' if not weather['is_synthetic'] else 'synthetic'} weather). Of the crops "
        f"this app supports, {best_name} is the best match for post-harvest "
        f"storage right now (closest to its ideal conditions, ~{round((best_mult - 1) * 100)}% "
        f"above its baseline decay rate). This reflects storage/spoilage suitability from "
        f"our decay model, not a full agronomic planting recommendation (soil, season length, "
        f"and market demand also matter)."
    )


def _no_batch_answer(lang: str) -> str:
    if lang == "hi":
        return "पहले एक फसल खेप चुनें, तब मैं आपकी असली जानकारी के आधार पर जवाब दे सकूंगा।"
    if lang == "mr":
        return "आधी एक पीक खेप निवडा, मग मी तुमच्या खऱ्या माहितीच्या आधारे उत्तर देऊ शकेन."
    return "Please select a crop batch first so I can answer using your actual data."


def _action_advice_answer(batch_id: int | None, lang: str) -> str:
    if batch_id is None:
        return _no_batch_answer(lang)
    risk = predict_spoilage(batch_id)
    if "error" in risk:
        return _no_batch_answer(lang)
    label_word = _RISK_LABEL_TEXT[lang][risk["risk_label"]]
    score = round(risk["risk_score"])
    best = get_best_destination(batch_id)
    market_name = best.get("best_market", {}).get("name") if "error" not in best else None

    if lang == "hi":
        urgency = "जल्द से जल्द" if risk["risk_label"] == "High" else "जल्द" if risk["risk_label"] == "Medium" else "सामान्य समय पर"
        text = f"आपकी फसल का खराब होने का खतरा {score}% ({label_word}) है। इसे {urgency} भेजें।"
        if market_name:
            text += f" फिलहाल {market_name} सबसे अच्छा विकल्प दिख रहा है।"
        return text
    if lang == "mr":
        urgency = "लवकरात लवकर" if risk["risk_label"] == "High" else "लवकर" if risk["risk_label"] == "Medium" else "नेहमीच्या वेळेत"
        text = f"तुमच्या पिकाचा खराब होण्याचा धोका {score}% ({label_word}) आहे. ते {urgency} पाठवा."
        if market_name:
            text += f" सध्या {market_name} सर्वात चांगला पर्याय दिसत आहे."
        return text
    urgency = "as soon as possible" if risk["risk_label"] == "High" else "soon" if risk["risk_label"] == "Medium" else "on your normal schedule"
    text = f"Your crop's spoilage risk is {score}% ({label_word}). Send it {urgency}."
    if market_name:
        text += f" Right now, {market_name} looks like the best market for it."
    return text


def _risk_explain_answer(batch_id: int | None, lang: str) -> str:
    if batch_id is None:
        return _no_batch_answer(lang)
    risk = predict_spoilage(batch_id)
    if "error" in risk:
        return _no_batch_answer(lang)
    label_word = _RISK_LABEL_TEXT[lang][risk["risk_label"]]
    score = round(risk["risk_score"])
    reasons = risk.get("top_reasons") or []
    reason_text = " ".join(reasons)  # explanation text is generated English-only, same limitation noted in Settings

    if lang == "hi":
        text = f"फसल खराब होने का खतरा {score}% है ({label_word} स्तर)।"
        if reason_text:
            text += f" मुख्य वजह: {reason_text}"
        return text
    if lang == "mr":
        text = f"पीक खराब होण्याचा धोका {score}% आहे ({label_word} पातळी)."
        if reason_text:
            text += f" मुख्य कारण: {reason_text}"
        return text
    text = f"The spoilage risk is {score}% ({label_word})."
    if reason_text:
        text += f" Main reason: {reason_text}"
    return text


def _market_explain_answer(batch_id: int | None, lang: str) -> str:
    if batch_id is None:
        return _no_batch_answer(lang)
    best = get_best_destination(batch_id)
    if "error" in best or "best_market" not in best:
        return _no_batch_answer(lang)
    m = best["best_market"]
    if lang == "hi":
        return (
            f"{m['name']} को सुझाया गया है क्योंकि यह अन्य बाजारों की तुलना में सबसे ज्यादा अनुमानित पैसा देता है "
            f"— ढुलाई खर्च (₹{m['transport_cost']:.0f}) और खराब होने के खतरे ({round(m['arrival_risk_pct'])}%) को "
            f"शामिल करने के बाद।"
        )
    if lang == "mr":
        return (
            f"{m['name']} सुचवले आहे कारण ते इतर बाजारपेठांच्या तुलनेत सर्वात जास्त अंदाजे पैसे देते "
            f"— वाहतूक खर्च (₹{m['transport_cost']:.0f}) आणि खराब होण्याचा धोका ({round(m['arrival_risk_pct'])}%) "
            f"यांचा विचार केल्यावर."
        )
    return (
        f"{m['name']} is recommended because it gives the highest expected money among the candidate markets, "
        f"after accounting for transport cost (₹{m['transport_cost']:.0f}) and spoilage risk ({round(m['arrival_risk_pct'])}%)."
    )


def _best_price_answer(batch_id: int | None, lang: str) -> str:
    if batch_id is None:
        return _no_batch_answer(lang)
    markets = get_candidate_markets(batch_id).get("markets", [])
    if not markets:
        return _no_batch_answer(lang)
    top = markets[0]  # already ranked by expected realised value, highest first
    if lang == "hi":
        return (
            f"{top['name']} सबसे ज्यादा अनुमानित पैसा देता है — करीब ₹{top['expected_realised_value']:.0f}, "
            f"ढुलाई खर्च और खराब होने का खतरा निकालने के बाद।"
        )
    if lang == "mr":
        return (
            f"{top['name']} सर्वात जास्त अंदाजे पैसे देते — सुमारे ₹{top['expected_realised_value']:.0f}, "
            f"वाहतूक खर्च आणि खराब होण्याचा धोका वजा केल्यानंतर."
        )
    return (
        f"{top['name']} gives the highest expected money — about ₹{top['expected_realised_value']:.0f}, "
        f"after transport cost and spoilage risk."
    )


def _temp_whatif_answer(batch_id: int | None, lang: str) -> str:
    if batch_id is None:
        return _no_batch_answer(lang)
    current = predict_spoilage(batch_id)
    if "error" in current:
        return _no_batch_answer(lang)
    hypothetical_temp = current["temperature_c"] + TEMP_WHATIF_DELTA_C
    result = what_if(batch_id, temperature_c=hypothetical_temp)
    if "error" in result:
        return _no_batch_answer(lang)
    before, after = result["before"], result["after"]
    before_value = f"₹{before['expected_realised_value']:.0f}" if before["expected_realised_value"] is not None else "—"
    after_value = f"₹{after['expected_realised_value']:.0f}" if after["expected_realised_value"] is not None else "—"

    # The trained model can genuinely plateau for a very fresh batch (the
    # days-since-harvest signal dominates at low values) -- a real "before"
    # == "after" is an honest model output, not a bug, but presenting it as
    # "38% to 38%" reads as broken. Say so explicitly instead.
    if round(before["risk_score"]) == round(after["risk_score"]):
        if lang == "hi":
            return (
                f"इस फसल के लिए, तापमान में {TEMP_WHATIF_DELTA_C:.0f}°C की बढ़ोतरी (~{hypothetical_temp:.0f}°C) से "
                f"खतरे में फिलहाल कोई बड़ा फर्क नहीं पड़ता — यह अभी बहुत ताज़ा है, इसलिए कटाई के बाद का समय ही "
                f"सबसे बड़ी वजह है। खतरा अभी {round(before['risk_score'])}% पर है।"
            )
        if lang == "mr":
            return (
                f"या पिकासाठी, तापमानात {TEMP_WHATIF_DELTA_C:.0f}°C वाढ (~{hypothetical_temp:.0f}°C) झाल्याने "
                f"सध्या धोक्यात फारसा फरक पडत नाही — ते सध्या खूप ताजे आहे, त्यामुळे काढणीनंतरचा वेळ हाच "
                f"सर्वात मोठा घटक आहे. धोका सध्या {round(before['risk_score'])}% आहे."
            )
        return (
            f"For this batch, a {TEMP_WHATIF_DELTA_C:.0f}°C rise (to ~{hypothetical_temp:.0f}°C) doesn't "
            f"meaningfully change the risk right now -- it's very fresh, so time since harvest is the "
            f"dominant factor rather than temperature. Risk is currently {round(before['risk_score'])}%."
        )

    if lang == "hi":
        return (
            f"अगर तापमान करीब {TEMP_WHATIF_DELTA_C:.0f}°C बढ़ जाए (~{hypothetical_temp:.0f}°C), तो खतरा "
            f"{round(before['risk_score'])}% से बढ़कर {round(after['risk_score'])}% हो सकता है, और अनुमानित पैसा "
            f"{before_value} से घटकर {after_value} हो सकता है।"
        )
    if lang == "mr":
        return (
            f"तापमान सुमारे {TEMP_WHATIF_DELTA_C:.0f}°C ने वाढले (~{hypothetical_temp:.0f}°C), तर धोका "
            f"{round(before['risk_score'])}% वरून {round(after['risk_score'])}% पर्यंत वाढू शकतो, आणि अंदाजे पैसे "
            f"{before_value} वरून {after_value} पर्यंत कमी होऊ शकतात."
        )
    return (
        f"If temperature rises by about {TEMP_WHATIF_DELTA_C:.0f}°C (to ~{hypothetical_temp:.0f}°C), risk could "
        f"rise from {round(before['risk_score'])}% to {round(after['risk_score'])}%, and expected money could "
        f"drop from {before_value} to {after_value}."
    )


def _reduce_loss_answer(batch_id: int | None, lang: str) -> str:
    if batch_id is not None:
        b = get_current_batch(batch_id)
        if "error" not in b:
            return _storage_answer(b["crop_type"], lang)
    if lang == "hi":
        return "फसल जल्द भेजें, धूप और गर्मी से बचाएं, और ठंडी व सूखी जगह पर रखें ताकि खराब होने की गति धीमी रहे।"
    if lang == "mr":
        return "पीक लवकर पाठवा, उन्हापासून आणि उष्णतेपासून वाचवा, आणि थंड व कोरड्या जागी ठेवा जेणेकरून खराब होण्याचा वेग कमी राहील."
    return "Send the crop soon, keep it out of direct sun/heat, and store it somewhere cool and dry to slow spoilage."


_NOT_RECOGNIZED_PREFIX = {
    "en": "I didn't recognize a supported crop or question type in that. ",
    "hi": "मुझे इसमें कोई समर्थित फसल या प्रश्न प्रकार नहीं मिला। ",
    "mr": "मला यामध्ये कोणतेही समर्थित पीक किंवा प्रश्नाचा प्रकार सापडला नाही. ",
}


def answer_question(question: str, farm_latitude: float | None = None,
                     farm_longitude: float | None = None, lang: str = "en",
                     batch_id: int | None = None) -> dict:
    lang = lang if lang in SUPPORTED_LANGS else "en"
    if not question or not question.strip():
        return {"answer": _help_text(lang), "matched_crop": None}

    q = question.lower().strip()
    crop = _find_crop(q, lang)
    kw = INTENT_KEYWORDS[lang]

    # Batch-context intents first -- these answer using the farmer's actual
    # selected batch (via gpt_tools' real backend calls, no GPT involved),
    # so they take priority over the generic crop-info intents below.
    if any(k in q for k in kw["action_advice"]):
        return {"answer": _action_advice_answer(batch_id, lang), "matched_crop": None}

    if any(k in q for k in kw["risk_explain"]):
        return {"answer": _risk_explain_answer(batch_id, lang), "matched_crop": None}

    if any(k in q for k in kw["market_explain"]):
        return {"answer": _market_explain_answer(batch_id, lang), "matched_crop": None}

    if any(k in q for k in kw["best_price"]):
        return {"answer": _best_price_answer(batch_id, lang), "matched_crop": None}

    if any(k in q for k in kw["temp_whatif"]):
        return {"answer": _temp_whatif_answer(batch_id, lang), "matched_crop": None}

    if any(k in q for k in kw["reduce_loss"]):
        return {"answer": _reduce_loss_answer(batch_id, lang), "matched_crop": None}

    if any(k in q for k in kw["plant"]):
        return {"answer": _planting_answer(farm_latitude, farm_longitude, lang), "matched_crop": None}

    if crop and any(k in q for k in kw["shelf_life"]):
        return {"answer": _shelf_life_answer(crop, lang), "matched_crop": crop}

    if crop and any(k in q for k in kw["spoilage"]):
        return {"answer": _spoilage_rate_answer(crop, lang), "matched_crop": crop}

    if crop and any(k in q for k in kw["storage"]):
        return {"answer": _storage_answer(crop, lang), "matched_crop": crop}

    if crop:
        # Crop named but intent unclear -- give the fullest single answer (shelf life).
        return {"answer": _shelf_life_answer(crop, lang), "matched_crop": crop}

    if any(k in q for k in kw["greeting"]):
        return {"answer": _help_text(lang), "matched_crop": None}

    return {"answer": _NOT_RECOGNIZED_PREFIX[lang] + _help_text(lang), "matched_crop": None}
