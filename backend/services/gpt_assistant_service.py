"""
GPT layer for the AgriRoute AI Assistant.

Strict division of responsibility (see MODEL.md / the app's own docs):

    XGBoost + destination_service   -> the actual numbers (risk, markets,
                                        routes, expected value)
    GPT (this file)                 -> explaining those numbers in simple,
                                        multilingual, conversational language

GPT is never allowed to compute or invent a risk score, price, distance or
expected value -- it can only call the tools in gpt_tools.py, which wrap the
same real backend functions the REST API uses. If a key isn't configured
(OPENAI_API_KEY empty) or the API call fails for any reason, the route
falls back to the existing rule-based responder (ai_assistant_service.py)
so the assistant never goes fully offline.
"""
import json

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    OpenAI,
    OpenAIError,
    RateLimitError,
)

from config import Config
from services.gpt_tools import TOOL_DISPATCH, TOOL_SCHEMAS

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 12
REQUEST_TIMEOUT_S = 20

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi (हिंदी)", "mr": "Marathi (मराठी)"}

_FALLBACK_TEXT = {
    "en": "I couldn't work out a full answer to that. Could you ask in a different way?",
    "hi": "मैं इसका पूरा जवाब नहीं दे पाया। क्या आप इसे दूसरे तरीके से पूछ सकते हैं?",
    "mr": "मला याचे पूर्ण उत्तर देता आले नाही. तुम्ही हे वेगळ्या पद्धतीने विचारू शकाल का?",
}


class GPTUnavailableError(Exception):
    """Raised for any OpenAI-side failure (missing key, auth, rate limit,
    timeout, connection) -- routes.py catches this and falls back to the
    rule-based assistant rather than showing the farmer a raw API error."""


def is_gpt_configured() -> bool:
    return bool(Config.OPENAI_API_KEY and Config.OPENAI_API_KEY.strip())


def _system_prompt(lang: str, batch_id: int | None) -> str:
    target_language = LANGUAGE_NAMES.get(lang, "English")
    context = _context_block(batch_id)

    return f"""You are the AgriRoute AI Assistant -- a feature inside the AgriRoute AI app that helps Indian
farmers understand their crop's spoilage risk, the best market to send it to, the route, and expected
earnings. You are NOT a general chatbot and you must never call yourself "ChatGPT" or mention OpenAI as
your product identity; you are an AgriRoute AI feature, powered by a GPT model, in service of the app.

ARCHITECTURE YOU MUST RESPECT:
- The app's XGBoost model and destination-optimization engine are the ONLY source of truth for spoilage
  risk scores, market prices, distances, travel time, transport cost, expected spoilage loss and expected
  realised value. You do not calculate any of these yourself.
- To answer any question that needs one of those numbers, you MUST call the matching tool
  (get_current_batch, predict_spoilage, get_candidate_markets, compare_markets, get_best_destination,
  calculate_route, calculate_expected_value, what_if). Never invent, estimate, or remember a number
  instead of calling a tool -- even if you think you already know it from earlier in the conversation,
  call the tool again if the question is about current data.
- If a tool returns an "error" field or says data isn't available, tell the farmer honestly that you
  don't have that verified information right now -- do not guess a plausible-sounding number instead.
- The optimizer's recommended market is final -- you explain WHY it was chosen using the real numbers,
  you never suggest a different market is "actually better" based on your own opinion.
- For "what if" questions (temperature, humidity, waiting N days), call the what_if tool and report its
  real before/after numbers. Never fabricate what a change "would" do.

LANGUAGE:
- Default response language: {target_language}.
- Exception: if the farmer's message is clearly written in Hindi or Marathi (even if the interface
  language is different), respond in that language instead.
- Keep sentences short and simple -- this is read on a phone, often by someone with limited formal
  education. Avoid ML/technical jargon (e.g. don't say "0.42 probability" or "classifier confidence" --
  say "42% risk of spoiling").

GENERAL AGRICULTURAL QUESTIONS:
- You may answer general questions (storage tips, packaging, causes of spoilage) from your own
  knowledge, but make clear this is general guidance, not an AgriRoute AI prediction -- don't present
  general knowledge as if it came from this app's model.
- For pesticides, chemicals, dosages, plant disease treatment or food-safety questions: do not give
  precise dosages or definitive treatment instructions. Encourage the farmer to check local agricultural
  extension guidance or the product label. Never pretend to be an agricultural officer.

RESPONSE FORMAT:
- Start with a short answer, 1-3 sentences.
- If the farmer should take an action, add a short bulleted "what to do" list (use plain "-" bullets).
- Add a brief "why" only if it adds real understanding -- keep the whole reply short enough to read
  comfortably on a phone. No long paragraphs.

CONVERSATION MEMORY:
- Use the conversation history to resolve references like "it", "that market", "this batch" to the
  batch/market already being discussed.

{context}"""


def _context_block(batch_id: int | None) -> str:
    if batch_id is None:
        return "CURRENT CONTEXT: No batch is currently selected by the farmer. If a question needs batch data, ask them to select a batch first, or use get_current_batch once one is selected."

    from services.gpt_tools import get_candidate_markets, get_current_batch, predict_spoilage

    batch = get_current_batch(batch_id)
    if "error" in batch:
        return f"CURRENT CONTEXT: batch_id={batch_id} was provided but not found. Treat this as no batch selected."

    risk = predict_spoilage(batch_id)
    markets = get_candidate_markets(batch_id).get("markets", [])[:3]

    return (
        "CURRENT CONTEXT (already fetched for you -- call the tools again only if you need fresher "
        "data or a different destination_id):\n"
        f"{json.dumps({'batch': batch, 'current_risk': risk, 'top_markets': markets}, ensure_ascii=False, indent=2)}"
    )


def _dispatch_tool_call(name: str, arguments: dict, batch_id: int | None) -> dict:
    fn = TOOL_DISPATCH.get(name)
    if fn is None:
        return {"error": f"Unknown tool: {name}"}

    args = dict(arguments)
    if "batch_id" in args:
        if batch_id is None:
            return {"error": "No batch is currently selected."}
        args["batch_id"] = batch_id  # always the server-trusted current batch, never GPT-supplied

    try:
        return fn(**args)
    except TypeError:
        return {"error": "Invalid arguments for this tool."}
    except Exception:
        return {"error": "Something went wrong fetching that data."}


def answer_with_gpt(question: str, batch_id: int | None, lang: str, history: list | None = None) -> dict:
    if not is_gpt_configured():
        raise GPTUnavailableError("OPENAI_API_KEY is not configured")

    client = OpenAI(api_key=Config.OPENAI_API_KEY, timeout=REQUEST_TIMEOUT_S)

    messages = [{"role": "system", "content": _system_prompt(lang, batch_id)}]
    for turn in (history or [])[-MAX_HISTORY_TURNS:]:
        role = "user" if turn.get("role") == "user" else "assistant"
        content = (turn.get("text") or "").strip()
        if content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            response = client.chat.completions.create(
                model=Config.OPENAI_MODEL,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                temperature=0.3,
            )
            message = response.choices[0].message

            if not message.tool_calls:
                return {"answer": (message.content or "").strip(), "matched_crop": None}

            messages.append(message)
            for tool_call in message.tool_calls:
                try:
                    arguments = json.loads(tool_call.function.arguments or "{}")
                except json.JSONDecodeError:
                    arguments = {}
                result = _dispatch_tool_call(tool_call.function.name, arguments, batch_id)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

        return {"answer": _FALLBACK_TEXT.get(lang, _FALLBACK_TEXT["en"]), "matched_crop": None}

    except (RateLimitError, APITimeoutError, APIConnectionError, AuthenticationError,
            APIStatusError, OpenAIError) as exc:
        raise GPTUnavailableError(str(exc)) from exc
