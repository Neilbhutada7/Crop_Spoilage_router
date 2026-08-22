import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppData } from "../AppDataContext";
import { api } from "../api";

function fmtRs(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

export default function BenchmarkComparison() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { risk, destinations: sessionDestinations } = useAppData();

  // AppDataContext only holds data for a batch checked earlier in THIS
  // session -- reaching this page via the sidebar leaves it empty even
  // though the farmer has a real batch on the server. Falls back to the
  // most recent one, same pattern as the other pages.
  const [fallbackDestinations, setFallbackDestinations] = useState(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  useEffect(() => {
    if (risk || sessionDestinations.length > 0) return;
    setFallbackLoading(true);
    api.getBatches()
      .then((rows) => rows?.[0] && api.getBatchDestinations(rows[0].id))
      .then((res) => setFallbackDestinations(res?.destinations || []))
      .catch(() => setFallbackDestinations([]))
      .finally(() => setFallbackLoading(false));
  }, [risk, sessionDestinations]);

  const destinations = sessionDestinations.length > 0 ? sessionDestinations : (fallbackDestinations || []);

  if (destinations.length === 0) {
    if (fallbackLoading) return <div className="text-sm text-gray-400">{t("common.loading")}</div>;
    return (
      <div className="bg-white border border-gray-200 rounded-md p-12 text-center">
        <p className="text-sm text-gray-500 mb-4">{t("market.summaryEmpty")}</p>
        <button onClick={() => navigate("/batch-analysis")} className="px-4 py-2 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800">
          {t("market.goToBatchAnalysis")}
        </button>
      </div>
    );
  }

  const nearest = [...destinations].sort((a, b) => a.distance_km - b.distance_km)[0];
  const highestPrice = [...destinations].sort((a, b) => b.expected_price - a.expected_price)[0];
  const priceDistance = [...destinations].sort((a, b) => (b.expected_price - 0.05 * b.distance_km) - (a.expected_price - 0.05 * a.distance_km))[0];
  const agriRoute = [...destinations].sort((a, b) => b.expected_realised_value - a.expected_realised_value)[0];

  const strategies = [
    { key: "nearest", label: t("compare.nearest"), desc: t("compare.nearestDesc"), dest: nearest },
    { key: "price", label: t("compare.highestPrice"), desc: t("compare.highestPriceDesc"), dest: highestPrice },
    { key: "pricedist", label: t("compare.priceMinusDistance"), desc: t("compare.priceMinusDistanceDesc"), dest: priceDistance },
    { key: "agriroute", label: t("compare.agriRoute"), desc: t("compare.agriRouteDesc"), dest: agriRoute, highlight: true },
  ];

  // Each strategy's own destination carries its own real arrival risk,
  // transport cost and expected value -- computed once, per destination,
  // on the backend (destination_service.py), not re-derived here.
  const rows = strategies.map((s) => ({
    ...s,
    market: s.dest.name,
    riskPct: s.dest.arrival_risk_score,
    transportCost: s.dest.transport_cost_total,
    revenue: s.dest.selling_revenue,
    finalValue: s.dest.expected_realised_value,
  }));

  const chartData = rows.map((r) => ({ name: r.label, Risk: Math.round(r.riskPct), Revenue: Math.round(r.revenue / 1000), Transport: Math.round(r.transportCost) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("compare.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("compare.subtitle")}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-5 py-2.5 font-semibold">{t("compare.strategyCol")}</th>
              <th className="px-5 py-2.5 font-semibold">{t("compare.marketCol")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{t("compare.riskCol")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{t("compare.travelCostCol")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{t("compare.earningsCol")}</th>
              <th className="px-5 py-2.5 font-semibold text-right">{t("compare.valueCol")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`border-b border-gray-50 last:border-0 ${r.highlight ? "bg-brand-50/50" : ""}`}>
                <td className="px-5 py-3">
                  <div className={`font-semibold ${r.highlight ? "text-brand-800" : "text-gray-800"}`}>{r.label}</div>
                  <div className="text-[11px] text-gray-400">{r.desc}</div>
                </td>
                <td className="px-5 py-3 text-gray-700">{r.market}</td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-700">{Math.round(r.riskPct)}%</td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-700">{fmtRs(r.transportCost)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-700">{fmtRs(r.revenue)}</td>
                <td className={`px-5 py-3 text-right tabular-nums font-bold ${r.highlight ? "text-brand-800" : "text-gray-900"}`}>{fmtRs(r.finalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {[
          { key: "Risk", title: `${t("compare.riskCol")} (%)`, color: "#dc2626" },
          { key: "Revenue", title: `${t("compare.earningsCol")} (₹ '000)`, color: "#1f6f4a" },
          { key: "Transport", title: `${t("compare.travelCostCol")} (₹)`, color: "#4f46e5" },
        ].map(({ key, title, color }) => (
          <div key={key} className="bg-white border border-gray-200 rounded-md p-4">
            <h3 className="text-xs font-bold text-gray-700 mb-3">{title}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Bar dataKey={key} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        {t("compare.footnote")}
      </p>
    </div>
  );
}
