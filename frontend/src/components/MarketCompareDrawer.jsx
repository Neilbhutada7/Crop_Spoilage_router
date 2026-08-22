import { useTranslation } from "react-i18next";
import { riskColor } from "../colors";
import { IconX } from "./Icons";

function fmtRs(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }
function fmtEta(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export default function MarketCompareDrawer({ destinations, recommendedId, selectedId, onSelect, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-sm flex flex-col animate-enter">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-800">{t("route.compareMarkets")}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{t("route.compareDrawerSubtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><IconX width={16} height={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2.5 font-semibold">{t("compare.marketCol")}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t("market.priceAtMarket")}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t("market.travelTime")}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t("market.cropRisk")}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t("market.travelCost")}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t("market.finalValue")}</th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((d) => {
                const isRecommended = d.destination_id === recommendedId;
                const isSelected = d.destination_id === selectedId;
                return (
                  <tr
                    key={d.destination_id}
                    onClick={() => onSelect(d)}
                    className={`cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50 ${isSelected ? "bg-brand-50/70" : isRecommended ? "bg-brand-50/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        {isRecommended && <span className="text-[9px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 border border-brand-200 rounded px-1.5 py-0.5">{t("route.strategy.bestValue")}</span>}
                        {d.name}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{d.type === "mandi" ? t("data.mandi") : t("data.storage")} &middot; {d.distance_km}{t("common.km")}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">₹{d.expected_price}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmtEta(d.travel_time_hours)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: riskColor(d.arrival_risk_label) }}>
                      {Math.round(d.arrival_risk_score)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmtRs(d.transport_cost_total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">{fmtRs(d.expected_realised_value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400">
          {t("route.compareDrawerHint")}
        </div>
      </div>
    </div>
  );
}
