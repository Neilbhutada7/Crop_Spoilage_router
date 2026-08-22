import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useDisplayMode } from "../DisplayModeContext";
import {
  IconGrid, IconLeaf, IconRoute, IconTruck, IconBarChart,
  IconTag, IconDatabase, IconSettings, IconSparkle, IconCamera, IconX
} from "./Icons";

const CORE_NAV_ITEMS = [
  { to: "/dashboard", key: "dashboard", icon: IconGrid },
  { to: "/batch-analysis", key: "batchAnalysis", icon: IconLeaf },
  { to: "/photo-analyzer", key: "photoAnalyzer", icon: IconCamera },
  { to: "/destination-optimizer", key: "destinationOptimizer", icon: IconRoute },
  { to: "/route-planner", key: "routePlanner", icon: IconTruck },
  { to: "/assistant", key: "aiAssistant", icon: IconSparkle },
];

// Detailed Mode only -- model internals and strategy benchmarking a farmer
// never needs, but a judge/logistics operator does (spec section 29).
const DETAILED_NAV_ITEMS = [
  { to: "/model-performance", key: "modelPerformance", icon: IconBarChart },
  { to: "/benchmark", key: "benchmarkComparison", icon: IconTag },
  { to: "/data-sources", key: "dataSources", icon: IconDatabase },
];

function StatusDot({ ok }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? "bg-brand-500" : "bg-amber-500"}`} />
  );
}

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { t } = useTranslation();
  const { simple } = useDisplayMode();
  const location = useLocation();
  const currentFullPath = location.pathname + location.search;
  const [apiOk, setApiOk] = useState(null);
  const [dbOk, setDbOk] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.health().then(() => !cancelled && setApiOk(true)).catch(() => !cancelled && setApiOk(false));
    // A real round trip through the DB (not just the API process being up).
    api.getDestinations().then(() => !cancelled && setDbOk(true)).catch(() => !cancelled && setDbOk(false));
    return () => { cancelled = true; };
  }, []);

  // Auto-close the mobile drawer whenever the route changes, so tapping a
  // nav link doesn't leave the overlay open behind the new page.
  useEffect(() => { onClose(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems = simple ? CORE_NAV_ITEMS : [...CORE_NAV_ITEMS, ...DETAILED_NAV_ITEMS];

  return (
    <>
      {/* Mobile-only backdrop, shown only while the drawer is open */}
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`w-64 shrink-0 h-screen fixed lg:sticky top-0 flex flex-col border-r border-gray-200 bg-white shadow-sm z-40 lg:z-20 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-sm bg-brand-700 flex items-center justify-center shrink-0">
            <IconLeaf width={18} height={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 leading-none">{t("brand")}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{t("sidebar.tagline")}</div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0">
            <IconX width={18} height={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, key, icon: Icon }) => {
            // Plain NavLink isActive matches on pathname only, so it can't
            // tell "/dashboard" apart from "/dashboard?tab=batches" -- several
            // of these items share the /dashboard route with a different tab
            // query, so active state is computed from the full path instead.
            const isActive = to === currentFullPath;
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 border-l-[3px] text-sm transition-colors ${
                  isActive
                    ? "border-brand-700 bg-brand-50 text-brand-800 font-semibold"
                    : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon width={17} height={17} className="text-brand-700" />
                {t(`nav.${key}`)}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 px-4 py-4 space-y-3">
          {!simple && (
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{t("sidebar.systemStatus")}</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-gray-500">
                  <span>{t("sidebar.backendApi")}</span>
                  <span className="flex items-center gap-1.5"><StatusDot ok={apiOk} /> {apiOk === null ? t("sidebar.checking") : apiOk ? t("sidebar.connected") : t("sidebar.demoMode")}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>{t("sidebar.database")}</span>
                  <span className="flex items-center gap-1.5"><StatusDot ok={dbOk} /> {dbOk === null ? t("sidebar.checking") : dbOk ? t("sidebar.connected") : t("sidebar.demoMode")}</span>
                </div>
              </div>
            </div>
          )}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${isActive ? "bg-brand-50 text-brand-700 font-bold shadow-inner" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`
            }
          >
            <IconSettings width={16} height={16} /> {t("nav.settings")}
          </NavLink>
        </div>
      </aside>
    </>
  );
}
