import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconSearch, IconBell, IconLogOut, IconMenu } from "./Icons";
import { useAppData } from "../AppDataContext";
import { api } from "../api";
import LanguageSelector from "./LanguageSelector";

function timeAgo(iso, t) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("topbar.justNow");
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function Topbar({ title, user, search, onSearchChange, onMenuClick }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDemo } = useAppData();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const [notifError, setNotifError] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.getNotifications()
      .then((rows) => { if (!cancelled) setNotifications(rows); })
      .catch((e) => { if (!cancelled) setNotifError(e.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [notifOpen]);

  async function toggleNotif() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      try {
        setNotifications(await api.getNotifications());
        setNotifError(null);
      } catch (e) {
        setNotifError(e.message);
      }
    }
  }

  async function handleLogout() {
    await api.logout().catch(() => {});
    navigate("/");
  }

  const initials = (user?.full_name || user?.username || "?")
    .split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 bg-white border-b border-gray-200">
      <button type="button" onClick={onMenuClick} className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0" title={t("topbar.openMenu")}>
        <IconMenu width={20} height={20} />
      </button>

      <span className="text-sm font-semibold text-gray-700 shrink-0 truncate">{title}</span>

      <div className="hidden sm:flex flex-1 max-w-sm items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-400">
        <IconSearch width={14} height={14} />
        <input
          type="text"
          placeholder={t("topbar.searchPlaceholder")}
          value={search || ""}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
        {isDemo && (
          <span className="hidden sm:inline text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {t("topbar.demoMode")}
          </span>
        )}
        <LanguageSelector compact />
        <div className="relative" ref={panelRef}>
          <button type="button" onClick={toggleNotif} className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100" title={t("topbar.notifications")}>
            <IconBell width={17} height={17} />
            {notifications && notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-sm z-40">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{t("topbar.notifications")}</span>
                <span className="text-[11px] text-gray-400">{notifications?.length ?? 0} {t("topbar.recent")}</span>
              </div>
              {notifError && (
                <p className="px-4 py-4 text-xs text-red-500">{t("topbar.notificationsError")}</p>
              )}
              {!notifError && notifications === null && (
                <p className="px-4 py-4 text-xs text-gray-400">{t("common.loading")}</p>
              )}
              {!notifError && notifications && notifications.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs font-semibold text-gray-500">{t("topbar.noNotifications")}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{t("topbar.noNotificationsHint")}</p>
                </div>
              )}
              {!notifError && notifications && notifications.length > 0 && (
                <ul className="divide-y divide-gray-50">
                  {notifications.map((n) => (
                    <li key={n.id} className="px-4 py-3 hover:bg-gray-50">
                      <p className="text-xs text-gray-700 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">#{n.batch_id} &middot; {timeAgo(n.created_at, t)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-700 text-white text-[11px] font-bold flex items-center justify-center">
            {initials}
          </div>
          <button type="button" onClick={handleLogout} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title={t("topbar.logOut")}>
            <IconLogOut width={15} height={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
