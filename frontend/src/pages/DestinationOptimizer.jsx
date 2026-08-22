import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAppData } from "../AppDataContext";
import { riskColor } from "../colors";
import { IconRoute, IconChevronRight, IconTrendingUp, IconWarehouse } from "../components/Icons";
import { api } from "../api";
import { useDisplayMode } from "../DisplayModeContext";

function fmtRs(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

function AvailabilityBadge({ t, market }) {
  if (market.type !== "storage_facility" || !market.availability_status) return null;
  const styles = {
    OPEN: "bg-brand-50 text-brand-700 border-brand-200",
    LIMITED: "bg-amber-50 text-amber-700 border-amber-200",
    FULL: "bg-red-50 text-red-700 border-red-200",
  };
  const labels = {
    OPEN: t("market.availabilityOpen"),
    LIMITED: t("market.availabilityLimited"),
    FULL: t("market.availabilityFull"),
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${styles[market.availability_status]}`} title={t("market.availabilityDemoNote")}>
      <IconWarehouse width={11} height={11} /> {labels[market.availability_status]}
    </span>
  );
}

export default function DestinationOptimizer() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { risk, destinations } = useAppData();
  const { simple } = useDisplayMode();

  // AppDataContext only holds data for a batch checked earlier in THIS
  // session -- reaching this page via the sidebar (rather than clicking
  // through right after "Check My Crop") leaves it empty even though the
  // farmer has real batches on the server. Falls back to the most recent
  // one, same pattern as PhotoAnalyzer/Dashboard, so navigation order never
  // produces a false "you haven't checked anything yet".
  const [fallbackDestinations, setFallbackDestinations] = useState(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  useEffect(() => {
    if (risk || destinations.length > 0) return;
    setFallbackLoading(true);
    api.getBatches()
      .then((rows) => rows?.[0] && api.getBatchDestinations(rows[0].id))
      .then((res) => setFallbackDestinations(res?.destinations || []))
      .catch(() => setFallbackDestinations([]))
      .finally(() => setFallbackLoading(false));
  }, [risk, destinations]);

  const effectiveDestinations = destinations.length > 0 ? destinations : (fallbackDestinations || []);

  if (effectiveDestinations.length === 0) {
    if (fallbackLoading) return <div className="text-sm text-gray-400">{t("common.loading")}</div>;
    return (
      <div className="bg-white border border-gray-200 rounded-md p-12 text-center">
        <p className="text-gray-500 mb-6">{t("market.summaryEmpty", "You need to check a crop first.")}</p>
        <button onClick={() => navigate("/batch-analysis")} className="px-6 py-3 bg-brand-700 text-white text-sm font-bold rounded-lg hover:bg-brand-800">
          {t("batch.submitButton")}
        </button>
      </div>
    );
  }

  const top3 = effectiveDestinations.slice(0, 3);
  const best = top3[0];
  const others = top3.slice(1);
  const riskLabelText = (label) => label === "High" ? t("risk.high") : label === "Medium" ? t("risk.medium") : t("risk.low");

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("market.title")}</h1>
        <p className="text-lg text-gray-600">{t("market.subtitle")}</p>
      </div>

      {/* TOP CHOICE CARD */}
      <section className="bg-white border-2 border-brand-500 rounded-md shadow-sm overflow-hidden relative animate-enter">
        <div className="bg-brand-700 text-white px-6 py-2 text-sm font-bold uppercase tracking-wide flex items-center gap-2">
          <span className="text-brand-300">&#9733;</span> {t("market.recommendTitle")}
        </div>

        <div className="p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">{best.name}</h2>
            <div className="text-sm font-medium text-gray-500 flex flex-wrap items-center gap-2 mb-6">
              <span>{best.type === "mandi" ? t("mapLegend.mandi") : t("mapLegend.storageFacility")}</span>
              <span>&middot;</span>
              <span>{best.distance_km} {t("mapLegend.away")}</span>
              <AvailabilityBadge t={t} market={best} />
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{t("market.expectedEarnings")}</div>
                <div className="text-2xl font-bold text-brand-700">{fmtRs(best.expected_realised_value)}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{t("market.travelTime")}</div>
                <div className="text-lg font-semibold text-gray-900">{best.travel_time_hours.toFixed(1)} {t("common.hours")}</div>
                <div className="text-sm text-gray-500">{fmtRs(best.transport_cost_total)}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{t("market.cropRisk")}</div>
                <div className="text-lg font-bold" style={{ color: riskColor(best.arrival_risk_label) }}>
                  {riskLabelText(best.arrival_risk_label)}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{t("market.priceAtMarket")}</div>
                <div className="text-lg font-semibold text-gray-900">₹{best.expected_price}/kg</div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto md:min-w-[200px]">
             <button onClick={() => navigate("/route-planner")} className="w-full py-4 px-6 bg-brand-700 text-white text-lg font-bold rounded-md hover:bg-brand-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                {t("market.viewRoute")} <IconRoute width={20} height={20} />
             </button>
          </div>
        </div>
      </section>

      {/* ALTERNATIVE CHOICES */}
      {others.length > 0 && (
        <section className="space-y-4 animate-enter" style={{ animationDelay: '100ms' }}>
          <h3 className="text-lg font-bold text-gray-700 uppercase tracking-wide">{t("market.otherMarkets")}</h3>

          <div className="grid md:grid-cols-2 gap-4">
            {others.map((market, idx) => (
              <div key={market.destination_id} className="bg-white border border-gray-200 rounded-md p-6 shadow-sm hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="text-xl font-bold text-gray-900">{market.name}</h4>
                  <AvailabilityBadge t={t} market={market} />
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-500">{t("market.expectedEarnings")}</span>
                    <span className="text-lg font-bold text-gray-900">{fmtRs(market.expected_realised_value)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                    <span className="text-sm font-semibold text-gray-500">{t("market.travelTime")}</span>
                    <span className="text-sm font-semibold text-gray-700">{market.travel_time_hours.toFixed(1)} {t("common.hours")} ({fmtRs(market.transport_cost_total)})</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                    <span className="text-sm font-semibold text-gray-500">{t("market.cropRisk")}</span>
                    <span className="text-sm font-bold" style={{ color: riskColor(market.arrival_risk_label) }}>
                      {riskLabelText(market.arrival_risk_label)}
                    </span>
                  </div>
                </div>

                <button onClick={() => navigate("/route-planner")} className="w-full py-3 bg-gray-100 text-gray-800 text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors">
                  {t("market.useThisMarket")}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ADVANCED */}
      {!simple && (
        <section className="bg-gray-900 border border-gray-800 rounded-md p-6 shadow-sm text-gray-300 text-sm mt-8 animate-enter">
          <h3 className="text-lg font-bold text-white mb-4">{t("photo.howCalculated")}</h3>
          <p className="mb-2"><strong>Target:</strong> Maximize Expected Realized Value.</p>
          <p className="mb-2"><code>Value = Selling Revenue - Transport Cost - Storage Cost - Expected Spoilage Loss</code></p>
          <p className="text-gray-400 mt-4 italic">Spoilage risk is predicted by the same XGBoost model shown on the Prediction Accuracy page, evaluated at this destination's own transit time.</p>
        </section>
      )}
    </div>
  );
}
