import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAppData } from "../AppDataContext";
import { IconSparkle, IconX, IconExternalLink } from "./Icons";

const MAX_HISTORY_SENT = 8;

export default function AssistantWidget() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const lang = i18n.language === "mr" ? "mr" : i18n.language === "hi" ? "hi" : "en";
  const { batch, farmLocation } = useAppData();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: t("assistant.greeting") }]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: "assistant", text: t("assistant.greeting") }]);
  }, [lang]);

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
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  const suggestions = t("assistant.suggestions", { returnObjects: true });

  // The full /assistant page already gives this experience with a batch
  // context panel, voice input and "Listen" -- avoid a redundant floating
  // duplicate on top of it.
  if (location.pathname === "/assistant") return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-700 text-white shadow-sm hover:bg-brand-800 flex items-center justify-center"
        title={t("assistant.title")}
      >
        <IconSparkle width={22} height={22} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[340px] bg-white border border-gray-200 rounded-md shadow-sm flex flex-col overflow-hidden animate-enter">
      <div className="flex items-center justify-between px-4 py-3 bg-brand-700 text-white">
        <span className="flex items-center gap-2 text-sm font-semibold"><IconSparkle width={15} height={15} /> {t("assistant.title")}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navigate("/assistant")} className="p-1 rounded hover:bg-white/15" title={t("assistant.title")}>
            <IconExternalLink width={14} height={14} />
          </button>
          <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/15"><IconX width={16} height={16} /></button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 max-h-72 overflow-y-auto px-3 py-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`text-[13px] leading-relaxed px-3 py-2 rounded-md max-w-[88%] ${
            m.role === "user" ? "bg-brand-700 text-white ml-auto rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"
          }`}>
            {m.text}
          </div>
        ))}
        {asking && <div className="text-[13px] text-gray-400 italic px-3">...</div>}
      </div>

      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {Array.isArray(suggestions) && suggestions.map((s) => (
          <button key={s} onClick={() => send(s)} className="text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1 hover:bg-brand-100">
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 p-3 border-t border-gray-100">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("assistant.placeholder")}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand-600"
        />
        <button type="submit" disabled={asking || !input.trim()} className="px-3.5 py-2 bg-brand-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          {t("assistant.askButton")}
        </button>
      </form>
      <p className="px-3 pb-3 text-[10px] text-gray-400 leading-relaxed">
        {t("assistant.disclaimer")}
      </p>
    </div>
  );
}
