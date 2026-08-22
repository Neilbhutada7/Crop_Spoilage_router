import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppData } from "../AppDataContext";
import { IconLeaf, IconGauge, IconRoute, IconTruck } from "../components/Icons";
import LanguageSelector from "../components/LanguageSelector";

const DEMO_USERNAME = "demo_judge";
const DEMO_PASSWORD = "sih2026demo";

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setIsDemo } = useAppData();
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await api.login(username, password);
      else await api.signup(username, password, fullName);
      navigate("/dashboard");
    } catch (err) {
      setError(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleViewDemo() {
    setError(null);
    setBusy(true);
    setIsDemo(true);
    try {
      try {
        await api.login(DEMO_USERNAME, DEMO_PASSWORD);
      } catch {
        await api.signup(DEMO_USERNAME, DEMO_PASSWORD, "SIH Judge");
      }
      navigate("/dashboard");
    } catch (err) {
      setError(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { icon: IconLeaf, label: t("landing.step1") },
    { icon: IconGauge, label: t("landing.step2") },
    { icon: IconRoute, label: t("landing.step3") },
    { icon: IconTruck, label: t("landing.step4") },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between gap-2.5 px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-brand-700 flex items-center justify-center">
            <IconLeaf width={16} height={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-gray-900">{t("brand")}</span>
        </div>
        <LanguageSelector />
      </header>

      <div className="max-w-5xl mx-auto px-8 pt-6 pb-24 grid md:grid-cols-2 gap-14 items-start">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 bg-brand-50 px-3 py-1 rounded-full mb-6">
            Smart India Hackathon 2026
          </div>
          <h1 className="text-4xl md:text-[2.7rem] font-bold text-gray-900 leading-[1.12] tracking-tight mb-5">
            {t("landing.heroQuestion")}
          </h1>
          <p className="text-[15px] text-gray-600 leading-relaxed mb-8 max-w-md">
            {t("landing.heroSubtitle")}
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <button
              type="button"
              onClick={() => { setShowAuth(true); setMode("login"); }}
              className="px-6 py-3 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800 transition-colors"
            >
              {t("landing.login")}
            </button>
            <button
              type="button"
              onClick={handleViewDemo}
              disabled={busy}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {busy ? t("landing.pleaseWait") : t("landing.viewDemo")}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 max-w-lg">
            {steps.map(({ icon: Icon, label }, i) => (
              <div key={label} className="border border-gray-100 rounded-md p-3 text-center">
                <div className="w-7 h-7 mx-auto rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center mb-2">{i + 1}</div>
                <Icon width={16} height={16} className="text-brand-700 mb-1.5 mx-auto" />
                <div className="text-[11px] font-semibold text-gray-700 leading-snug">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {showAuth && (
          <div className="border border-gray-200 rounded-md p-7 shadow-sm animate-enter">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-5">
              <button type="button" onClick={() => setMode("login")} className={`flex-1 py-2 text-sm font-medium rounded-md ${mode === "login" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>{t("landing.login")}</button>
              <button type="button" onClick={() => setMode("signup")} className={`flex-1 py-2 text-sm font-medium rounded-md ${mode === "signup" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>{t("landing.signup")}</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <label className="block text-xs font-semibold text-gray-600">
                  {t("landing.fullName")}
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ramesh Patil"
                    className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
                </label>
              )}
              <label className="block text-xs font-semibold text-gray-600">
                {t("landing.username")}
                <input required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ramesh_fpo"
                  className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                {t("landing.password")}
                <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
              </label>

              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

              <button type="submit" disabled={busy} className="w-full py-3 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800 disabled:opacity-50">
                {busy ? t("landing.pleaseWait") : mode === "login" ? t("landing.loginButton") : t("landing.signupButton")}
              </button>
            </form>
            <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
              {t("landing.authHint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
