import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";
import { IconChevronRight } from "./Icons";

const FLAGS = { en: "🇬🇧", hi: "🇮🇳", mr: "🇮🇳" };

// The highly-visible language switcher the spec asks for: flag + native
// name for each option (not bare "EN / HI / MR"), labeled "भाषा / Language"
// so it's findable regardless of which language is currently active.
export default function LanguageSelector({ compact = false }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const current = i18n.language && SUPPORTED_LANGUAGES.includes(i18n.language) ? i18n.language : "en";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm"
        }`}
      >
        <span>{FLAGS[current]}</span>
        <span>{t(`languageSelector.${current}`)}</span>
        <IconChevronRight width={12} height={12} className={`text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-sm z-50 py-1.5 overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {t("languageSelector.label")} / Language
          </div>
          {SUPPORTED_LANGUAGES.map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => { i18n.changeLanguage(lng); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                current === lng ? "bg-brand-50 text-brand-800 font-semibold" : "text-gray-700"
              }`}
            >
              <span className="text-base">{FLAGS[lng]}</span>
              <span>{t(`languageSelector.${lng}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
