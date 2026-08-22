import { useNavigate, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSelector from "../components/LanguageSelector";
import { useDisplayMode } from "../DisplayModeContext";
import { api } from "../api";

function Row({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm text-gray-700">{label}</div>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default function Settings() {
  const { user } = useOutletContext();
  const { t } = useTranslation();
  const { simple, setSimple } = useDisplayMode();
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout().catch(() => {});
    navigate("/");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("settings.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-3">{t("settings.account")}</h2>
        <Row label={t("settings.username")} value={user?.username} />
        <Row label={t("settings.fullName")} value={user?.full_name || "—"} />
        <button onClick={handleLogout} className="mt-4 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100">
          {t("settings.logOut")}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-1">{t("settings.language")}</h2>
        <p className="text-xs text-gray-400 mb-3">{t("settings.languageNote")}</p>
        <LanguageSelector />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-1">{t("settings.displayMode")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("settings.displayModeNote")}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSimple(true)}
            className={`text-left p-4 rounded-md border-2 ${simple ? "border-brand-600 bg-brand-50" : "border-gray-200 hover:bg-gray-50"}`}
          >
            <div className={`text-sm font-bold ${simple ? "text-brand-800" : "text-gray-700"}`}>{t("settings.simpleMode")}</div>
            <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">{t("settings.simpleModeDesc")}</div>
          </button>
          <button
            onClick={() => setSimple(false)}
            className={`text-left p-4 rounded-md border-2 ${!simple ? "border-brand-600 bg-brand-50" : "border-gray-200 hover:bg-gray-50"}`}
          >
            <div className={`text-sm font-bold ${!simple ? "text-brand-800" : "text-gray-700"}`}>{t("settings.detailedMode")}</div>
            <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">{t("settings.detailedModeDesc")}</div>
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-1">{t("settings.constants")}</h2>
        <p className="text-xs text-gray-400 mb-3">{t("settings.constantsNote")}</p>
        <Row label={t("settings.searchRadius")} value="250 km" />
        <Row label={t("settings.transportRate")} value="₹0.012 / kg / km" />
        <Row label={t("settings.storageRate")} value="₹0.50 / kg" />
        <Row label={t("settings.avgSpeed")} value="35 km/h" />
      </div>

      <p className="text-[11px] text-gray-400 text-center pt-2">{t("shell.hackathonLabel")}</p>
    </div>
  );
}
