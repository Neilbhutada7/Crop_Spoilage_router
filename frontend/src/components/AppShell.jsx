import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AssistantWidget from "./AssistantWidget";
import { api } from "../api";

const PAGE_TITLE_KEYS = {
  "/dashboard": "nav.dashboard",
  "/assistant": "nav.aiAssistant",
  "/photo-analyzer": "nav.photoAnalyzer",
  "/batch-analysis": "nav.batchAnalysis",
  "/destination-optimizer": "nav.destinationOptimizer",
  "/route-planner": "nav.routePlanner",
  "/model-performance": "nav.modelPerformance",
  "/benchmark": "nav.benchmarkComparison",
  "/data-sources": "nav.dataSources",
  "/settings": "nav.settings",
};

export default function AppShell({ search, onSearchChange }) {
  const { t } = useTranslation();
  const [user, setUser] = useState(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">{t("common.loading")}</div>;
  }
  if (user === null) {
    return <Navigate to="/" replace />;
  }

  const titleKey = PAGE_TITLE_KEYS[location.pathname];

  return (
    <div className="min-h-screen bg-surface-light">
      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar
            title={titleKey ? t(titleKey) : t("brand")}
            user={user}
            search={search}
            onSearchChange={onSearchChange}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto">
            <Outlet context={{ search, user, setUser }} />
          </main>
        </div>
        <AssistantWidget />
      </div>
    </div>
  );
}
