import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppData } from "../AppDataContext";
import { riskColor } from "../colors";
import FormattedMessage from "../components/FormattedMessage";
import { IconSparkle, IconMic, IconVolume, IconRoute, IconTag, IconGauge } from "../components/Icons";

const SPEECH_LANG = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
const MAX_HISTORY_SENT = 12;

function fmtRs(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

export default function AiAssistant() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "mr" ? "mr" : i18n.language === "hi" ? "hi" : "en";
  const { batch: sessionBatch, risk: sessionRisk, destinations: sessionDestinations, farmLocation: sessionFarmLocation } = useAppData();

  // AppDataContext only holds data for a batch checked earlier in THIS
  // session -- reaching this page via the sidebar leaves it empty even
  // though the farmer has a real current batch on the server, which would
  // otherwise mean the assistant answers with no batch grounding at all.
  // Falls back to the most recent one, same pattern as the other pages.
  const [fallback, setFallback] = useState(null);
  useEffect(() => {
    if (sessionBatch) return;
    api.getBatches().then((rows) => {
      const current = rows?.[0];
      if (!current) return;
      Promise.all([
        api.getBatchRisk(current.id).catch(() => null),
        api.getBatchDestinations(current.id).catch(() => null),
      ]).then(([riskResult, destResult]) => {
        setFallback({
          batch: current,
          risk: riskResult,
          destinations: destResult?.destinations || [],
          farmLocation: { latitude: current.farm_latitude, longitude: current.farm_longitude, name: current.farm_name },
        });
      });
    }).catch(() => {});
  }, [sessionBatch]);

  const batch = sessionBatch || fallback?.batch || null;
  const risk = sessionRisk || fallback?.risk || null;
  const destinations = sessionDestinations?.length ? sessionDestinations : (fallback?.destinations || []);
  const farmLocation = sessionFarmLocation || fallback?.farmLocation || null;

  const [messages, setMessages] = useState([{ role: "assistant", text: t("assistant.greeting") }]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  const speechRecognitionSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const speechSynthesisSupported = typeof window !== "undefined" && !!window.speechSynthesis;

  useEffect(() => {
    setMessages([{ role: "assistant", text: t("assistant.greeting") }]);
  }, [lang]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
  }, [messages]);

  const topMarket = destinations?.[0];
  const quickQuestions = t("assistant.quickQuestions", { returnObjects: true });

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || asking) return;
    setInput("");
    const nextMessages = [...messages, { role: "user", text: q }];
    setMessages(nextMessages);
    setAsking(true);
    try {
      const history = nextMessages.slice(-MAX_HISTORY_SENT).map((m) => ({ role: m.role, text: m.text }));
      const res = await api.askAssistant(q, farmLocation, lang, { batchId: batch?.id, history });
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t("assistant.unavailable") }]);
    } finally {
      setAsking(false);
    }
  }

  function handleMic() {
    if (!speechRecognitionSupported) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = SPEECH_LANG[lang] || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) send(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function handleListen(text) {
    if (!speechSynthesisSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#-]/g, ""));
    utterance.lang = SPEECH_LANG[lang] || "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{t("assistant.title")}</h1>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
            {t("assistant.identityLabel")}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{t("assistant.subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* LEFT: chat */}
        <div className="bg-white border border-gray-200 rounded-md flex flex-col" style={{ height: 600 }}>
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-md px-4 py-2.5 text-[15px] leading-relaxed ${
                  m.role === "user" ? "bg-brand-700 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  <FormattedMessage text={m.text} />
                  {m.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => handleListen(m.text)}
                      disabled={!speechSynthesisSupported}
                      title={speechSynthesisSupported ? t("assistant.listen") : t("assistant.listenUnsupported")}
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-brand-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                    >
                      <IconVolume width={12} height={12} /> {t("assistant.listen")}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 text-sm italic rounded-md rounded-bl-sm px-4 py-2.5">{t("assistant.thinking")}</div>
              </div>
            )}
          </div>

          <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-gray-50 pt-2.5">
            {Array.isArray(quickQuestions) && quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={asking}
                className="text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1 hover:bg-brand-100 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 p-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleMic}
              disabled={!speechRecognitionSupported || listening}
              title={speechRecognitionSupported ? t("assistant.mic") : t("assistant.micUnsupported")}
              className={`shrink-0 p-2.5 rounded-full border ${listening ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "border-gray-300 text-gray-500 hover:bg-gray-50"} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <IconMic width={16} height={16} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? t("assistant.listening") : t("assistant.placeholder")}
              className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-full text-sm outline-none focus:border-brand-600"
            />
            <button type="submit" disabled={asking || !input.trim()} className="shrink-0 p-2.5 rounded-full bg-brand-700 text-white disabled:opacity-50">
              <IconSparkle width={16} height={16} />
            </button>
          </form>
          <p className="px-4 pb-3 text-[10px] text-gray-400 leading-relaxed">{t("assistant.disclaimer")}</p>
        </div>

        {/* RIGHT: current batch context */}
        <div className="bg-white border border-gray-200 rounded-md p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3">{t("assistant.batchContext.title")}</h2>
          {!batch ? (
            <div className="text-center py-6">
              <p className="text-xs text-gray-400 mb-3">{t("assistant.batchContext.noBatch")}</p>
              <button onClick={() => navigate("/batch-analysis")} className="px-4 py-2 bg-brand-700 text-white text-xs font-semibold rounded-lg hover:bg-brand-800">
                {t("assistant.batchContext.selectBatch")}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 text-sm">
              <Row label={t("assistant.batchContext.crop")} value={t(`crops.${batch.crop_type}`, batch.crop_type)} />
              <Row label={t("assistant.batchContext.quantity")} value={`${batch.quantity_kg?.toLocaleString("en-IN")} ${t("common.kg")}`} />
              {risk && (
                <>
                  <Row label={t("assistant.batchContext.harvestAge")} value={t("common.dayCount", { count: risk.days_since_harvest })} />
                  <Row label={t("assistant.batchContext.temperature")} value={`${risk.temperature_c}°C`} />
                  <Row label={t("assistant.batchContext.humidity")} value={`${risk.humidity_pct}%`} />
                  <Row
                    label={t("assistant.batchContext.currentRisk")}
                    value={<span className="font-bold" style={{ color: riskColor(risk.risk_label) }}>{Math.round(risk.risk_score)}%</span>}
                  />
                </>
              )}
              {topMarket && (
                <>
                  <Row label={t("assistant.batchContext.recommendedMarket")} value={topMarket.name} />
                  <Row label={t("assistant.batchContext.expectedValue")} value={<span className="font-bold text-brand-700">{fmtRs(topMarket.expected_realised_value)}</span>} />
                </>
              )}

              <button onClick={() => navigate("/destination-optimizer")} className="w-full mt-2 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50">
                {t("assistant.batchContext.viewFullAnalysis")}
              </button>

              <div className="pt-3 mt-1 border-t border-gray-100 grid grid-cols-1 gap-1.5">
                <ActionButton icon={IconGauge} label={t("assistant.actions.analyseRisk")} onClick={() => navigate("/batch-analysis")} />
                <ActionButton icon={IconTag} label={t("assistant.actions.compareMarkets")} onClick={() => navigate("/destination-optimizer")} />
                <ActionButton icon={IconRoute} label={t("assistant.actions.viewRoute")} onClick={() => navigate("/route-planner")} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="font-semibold text-gray-800 text-right">{value}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
      <Icon width={13} height={13} className="text-brand-700" /> {label}
    </button>
  );
}
