import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppData } from "../AppDataContext";
import { api } from "../api";
import MapView from "../components/MapView";
import GoogleRouteMap from "../components/GoogleRouteMap";
import { isGoogleMapsConfigured } from "../services/googleMapsService";
import { pickAlternatives } from "../services/destinationService";
import { pickRouteStrategies, buildWhyReasons } from "../services/optimizationService";
import { riskColor } from "../colors";
import { IconCheck, IconExternalLink, IconZap, IconTruck, IconShield, IconStar, IconPlay } from "../components/Icons";

function fmtRs(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }
function fmtEta(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}
function fmtTime(date) { return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); }
function googleMapsDirectionsUrl(origin, destination) {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
}

export default function RoutePlanner() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { batch, risk, destinations, farmLocation, isDemo, loadDemoBatch } = useAppData();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState("bestValue");
  const useGoogle = isGoogleMapsConfigured();

  // AppDataContext only holds data for a batch checked earlier in THIS
  // session -- reaching this page via the sidebar leaves it empty even
  // though the farmer has a real batch on the server. Falls back to the
  // most recent one, same pattern as PhotoAnalyzer/DestinationOptimizer.
  const [fallback, setFallback] = useState(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  useEffect(() => {
    if (risk || destinations.length > 0) return;
    setFallbackLoading(true);
    api.getBatches()
      .then((rows) => {
        const current = rows?.[0];
        if (!current) return null;
        return api.getBatchDestinations(current.id).then((res) => ({
          destinations: res?.destinations || [],
          farmLocation: { latitude: current.farm_latitude, longitude: current.farm_longitude, name: current.farm_name },
          batch: current,
        }));
      })
      .then((res) => setFallback(res))
      .catch(() => setFallback({ destinations: [] }))
      .finally(() => setFallbackLoading(false));
  }, [risk, destinations]);

  const effectiveDestinations = destinations.length > 0 ? destinations : (fallback?.destinations || []);
  const effectiveFarmLocation = farmLocation || fallback?.farmLocation || null;
  const effectiveBatch = batch || fallback?.batch || null;

  const strategies = useMemo(() => pickRouteStrategies(effectiveDestinations), [effectiveDestinations]);

  async function handleLoadDemo() {
    setLoadingDemo(true);
    try {
      await loadDemoBatch();
    } finally {
      setLoadingDemo(false);
    }
  }

  if (effectiveDestinations.length === 0 || !strategies) {
    if (fallbackLoading) return <div className="text-sm text-gray-400">{t("common.loading")}</div>;
    return (
      <div className="bg-white border border-gray-200 rounded-md p-12 text-center">
        <p className="text-gray-500 mb-6">{t("route.emptyState")}</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => navigate("/batch-analysis")} className="px-6 py-3 bg-brand-700 text-white text-sm font-bold rounded-lg hover:bg-brand-800">
            {t("market.goToBatchAnalysis")}
          </button>
          <button onClick={handleLoadDemo} disabled={loadingDemo} className="flex items-center gap-2 px-6 py-3 border border-brand-300 text-brand-700 text-sm font-bold rounded-lg hover:bg-brand-50 disabled:opacity-50">
            <IconPlay width={16} height={16} /> {loadingDemo ? t("route.loadingDemo") : t("route.loadDemo")}
          </button>
        </div>
      </div>
    );
  }

  const selected = strategies[activeStrategy] || strategies.bestValue;
  const alternatives = pickAlternatives(effectiveDestinations, selected.destination_id, 2);

  const now = new Date();
  const arrival = new Date(now.getTime() + selected.travel_time_hours * 3600 * 1000);

  const STRATEGY_CARDS = [
    { key: "fastest", labelKey: "route.strategy.fastest", icon: IconZap },
    { key: "lowestCost", labelKey: "route.strategy.lowestCost", icon: IconTruck },
    { key: "lowestRisk", labelKey: "route.strategy.lowestRisk", icon: IconShield },
    { key: "bestValue", labelKey: "route.strategy.bestValue", icon: IconStar },
  ];

  const riskLabelText = (label) => label === "High" ? t("risk.high") : label === "Medium" ? t("risk.medium") : t("risk.low");

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("route.title")}</h1>
          <p className="text-lg text-gray-600 mt-1">{t("route.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && <button onClick={handleLoadDemo} disabled={loadingDemo} className="flex items-center gap-2 px-4 py-2 border border-brand-300 text-brand-700 text-sm font-bold rounded-lg hover:bg-brand-50 disabled:opacity-50"><IconPlay width={14} height={14} /> {t("route.loadDemo")}</button>}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">{t("route.chooseWhatMatters")}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STRATEGY_CARDS.map(({ key, labelKey, icon: Icon }) => {
            const dest = strategies[key];
            if (!dest) return null;
            const isActive = activeStrategy === key;
            return (
              <button
                key={key}
                onClick={() => setActiveStrategy(key)}
                className={`text-left px-5 py-4 rounded-md border transition-all flex items-start gap-3 ${
                  isActive ? "border-brand-500 bg-brand-50 shadow-sm" : "border-brand-100 bg-white hover:border-brand-200"
                }`}
              >
                <div className={`mt-0.5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>
                  <Icon width={18} height={18} />
                </div>
                <div>
                  <div className={`font-bold ${isActive ? "text-brand-800" : "text-gray-700"}`}>{t(labelKey)}</div>
                  <div className="text-[12px] text-gray-500 truncate w-full mt-0.5">{dest.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: Map */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden relative shadow-sm" style={{ height: 600 }}>
          {!useGoogle && (
            <div className="absolute top-4 left-4 z-[500] px-4 py-2 rounded-lg bg-white/95 border border-gray-200 text-sm font-medium text-gray-600 shadow-sm">
              {t("route.mapFallbackNote")}
            </div>
          )}
          {useGoogle ? (
            <GoogleRouteMap
              farmLocation={effectiveFarmLocation}
              recommended={selected}
              alternatives={alternatives}
              selectedId={selected.destination_id}
              onSelectDestination={() => {}}
            />
          ) : (
            <MapView destinations={[selected, ...alternatives]} farmLocation={effectiveFarmLocation} topDestinationId={selected.destination_id} />
          )}
        </div>

        {/* RIGHT: Simple Instructions */}
        <div className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-md p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t("route.journeyTitle")}</h2>

            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-brand-300 before:via-brand-200 before:to-brand-50">

              {/* Step 1 */}
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-brand-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                </div>
                <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-md border border-gray-100 bg-gray-50 shadow-sm ml-4 md:ml-0">
                  <div className="text-xs font-bold uppercase text-gray-400 mb-1">{t("route.farm")}</div>
                  <div className="text-lg font-bold text-gray-900">{effectiveBatch?.farm_name || t("route.farm")}</div>
                  <div className="text-sm text-gray-500 mt-1">{t("route.departure")}: {fmtTime(now)}</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-blue-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <IconTruck width={14} height={14} className="text-white" />
                </div>
                <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-md border border-gray-100 bg-white shadow-sm ml-4 md:ml-0">
                   <div className="text-xs font-bold uppercase text-gray-400 mb-1">{t("route.inTransit")}</div>
                  <div className="text-lg font-bold text-gray-900">{fmtEta(selected.travel_time_hours)}</div>
                  <div className="text-sm text-gray-500 mt-1">{selected.distance_km} km</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-brand-700 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <IconStar width={14} height={14} className="text-white" />
                </div>
                <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-md border-2 border-brand-500 bg-brand-50 shadow-sm ml-4 md:ml-0">
                  <div className="text-xs font-bold uppercase text-brand-600 mb-1">{t("route.marketArrival")}</div>
                  <div className="text-lg font-bold text-gray-900">{selected.name}</div>
                  <div className="text-sm font-semibold text-brand-700 mt-1">{t("route.expectedArrival")}: {fmtTime(arrival)}</div>
                </div>
              </div>

            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-md p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">{t("route.heading.bestValue")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">{t("route.predictedArrivalRisk")}</div>
                <div className="text-lg font-bold" style={{ color: riskColor(selected.arrival_risk_label) }}>
                  {riskLabelText(selected.arrival_risk_label)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{t("route.travelCostRow")}</div>
                <div className="text-lg font-bold text-gray-900">{fmtRs(selected.transport_cost_total)}</div>
              </div>
            </div>
            <a
              href={effectiveFarmLocation ? googleMapsDirectionsUrl(effectiveFarmLocation, selected) : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 w-full py-4 bg-brand-700 text-white text-lg font-bold rounded-md hover:bg-brand-800 transition-colors shadow-sm"
            >
               {t("route.openInGoogleMaps")} <IconExternalLink width={20} height={20} />
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
