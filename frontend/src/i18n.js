// react-i18next setup. Three complete languages (en/hi/mr), all sharing the
// same key structure across src/locales/<lang>/common.json -- i18next falls
// back to English for any key missing in hi/mr (never shows a raw dotted
// key), and in dev logs a console warning for any missing key so gaps are
// caught before a demo, not during one.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en/common.json";
import hi from "./locales/hi/common.json";
import mr from "./locales/mr/common.json";

export const SUPPORTED_LANGUAGES = ["en", "hi", "mr"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      hi: { common: hi },
      mr: { common: mr },
    },
    ns: ["common"],
    defaultNS: "common",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "agriroute_lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, ns, key) => console.warn(`[i18n] Missing key "${key}" for language(s): ${lngs.join(", ")}`)
      : undefined,
  });

export default i18n;
