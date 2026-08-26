import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppData } from "../AppDataContext";
import { riskColor } from "../colors";
import {
  IconChevronRight, IconLeaf, IconRoute, IconClock,
  IconCheck, IconTruck, IconWarehouse, IconZap,
  IconGauge, IconAlertTriangle, IconTag, IconTrendingUp,
} from "../components/Icons";

const RECENT_LIMIT = 5;

function money(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }
function riskLabelText(t, label) {
  return label === "High" ? t("risk.high") : label === "Medium" ? t("risk.medium") : t("risk.low");
}

// ---- Header -------------------------------------------------------------
function PageHeader({ t, onCheckCrop, onViewBatches, hasBatches }) {
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "dashboard.greetingMorning" : hour < 17 ? "dashboard.greetingAfternoon" : "dashboard.greetingEvening";
  return (
    <div>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("dashboard.pageLabel")}</div>
      <h1 className="text-[28px] leading-tight font-bold text-gray-900">{t(greetingKey)}</h1>
      <p className="text-base text-gray-500 mt-1.5 max-w-xl">{t("dashboard.heroTagline")}</p>
      <div className="flex flex-wrap items-center gap-5 mt-4">
        <button
          onClick={onCheckCrop}
          className="px-5 py-2.5 bg-brand-700 text-white text-sm font-bold rounded-xl hover:bg-brand-800 transition-colors"
        >
          {t("dashboard.checkNewCrop")}
        </button>
        {hasBatches && (
          <button onClick={onViewBatches} className="text-sm font-semibold text-gray-600 hover:text-brand-700 hover:underline underline-offset-4">
            {t("dashboard.viewMyBatches")}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Current harvest, horizontal ----------------------------------------
function CurrentHarvestRow({ t, batch, isDemoBatch }) {
  const label = batch.latest_risk_label;
  const color = label ? riskColor(label) : "#6b7280";
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t("dashboard.currentHarvestTitle")}</div>
        {isDemoBatch && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{t("dashboard.demoBatchLabel")}</span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold text-gray-900 capitalize">{t(`crops.${batch.crop_type}`, batch.crop_type)}</span>
        <span className="text-lg text-gray-400 font-medium">{batch.quantity_kg.toLocaleString("en-IN")} {t("common.kg")}</span>
        <span className="text-base font-bold ml-1" style={{ color }}>{label ? riskLabelText(t, label) : t("dashboard.notAssessed")}</span>
      </div>
      <p className="text-sm text-gray-500 mt-1.5">
        {batch.days_since_harvest === 0 ? t("common.harvestedToday") : t("common.harvestedDaysAgo", { days: batch.days_since_harvest })}
        {" · "}{batch.farm_name || t("dashboard.unknownOrigin")}
      </p>
    </div>
  );
}

// ---- Summary Cards ------------------------------------------------------
function CropHealthCard({ t, risk, navigate }) {
  if (!risk) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 text-sm text-gray-400 h-full">{t("common.loading")}</div>;
  const color = riskColor(risk.risk_label);
  const days = Math.max(0, Math.round(risk.estimated_remaining_shelf_life_days));
  return (
    <div onClick={() => navigate("/batch-analysis")} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 cursor-pointer hover:shadow-md transition-shadow group relative h-full flex flex-col">
      <div className="absolute top-6 right-6 text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconChevronRight width={20} height={20} />
      </div>
      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
        <IconAlertTriangle width={14} height={14} /> {t("dashboard.cropHealthTitle")}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{Math.round(risk.risk_score)}%</span>
        <span className="text-base font-semibold" style={{ color }}>{riskLabelText(t, risk.risk_label)}</span>
      </div>
      <p className="text-sm text-gray-500 flex-1">
        {risk.shelf_life_estimate_capped && risk.risk_label !== "Low" 
          ? t("dashboard.riskStaysElevated", { score: Math.round(risk.risk_score) })
          : t(risk.shelf_life_estimate_capped ? "dashboard.moreThanDays" : "dashboard.aboutDays", { days, count: days })
        }
      </p>
    </div>
  );
}

function MarketStrategyCard({ t, navigate, destinations, recommended }) {
  if (!destinations || !recommended) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 text-sm text-gray-400 h-full">{t("common.loading")}</div>;
  
  const mandis = destinations.filter((d) => d.type === "mandi");
  const storages = destinations.filter((d) => d.type === "storage_facility");
  const bestMandi = mandis.length ? [...mandis].sort((a, b) => b.expected_realised_value - a.expected_realised_value)[0] : null;
  const bestStorage = storages.length ? [...storages].sort((a, b) => b.expected_realised_value - a.expected_realised_value)[0] : null;
  const sellWins = bestMandi && (!bestStorage || bestMandi.expected_realised_value >= bestStorage.expected_realised_value);

  return (
    <div onClick={() => navigate("/destination-optimizer")} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 cursor-pointer hover:shadow-md transition-shadow group relative h-full flex flex-col">
      <div className="absolute top-6 right-6 text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconChevronRight width={20} height={20} />
      </div>
      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
        <IconTag width={14} height={14} /> {t("dashboard.recommendedMarketLabel")}
      </div>
      <div className="text-xl font-bold text-gray-900 mb-1">{recommended.name}</div>
      <div className="text-lg font-bold text-brand-700 mb-2">{money(recommended.expected_realised_value)}</div>
      <p className="text-sm font-semibold text-gray-600 flex-1">
        {sellWins ? t("dashboard.sellNowLabel") : t("dashboard.storeLabel")}
      </p>
    </div>
  );
}

function TransportRouteCard({ t, navigate, recommended }) {
  if (!recommended) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 text-sm text-gray-400 h-full">{t("common.loading")}</div>;
  
  return (
    <div onClick={() => navigate("/route-planner")} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7 cursor-pointer hover:shadow-md transition-shadow group relative h-full flex flex-col">
      <div className="absolute top-6 right-6 text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconChevronRight width={20} height={20} />
      </div>
      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
        <IconTruck width={14} height={14} /> {t("dashboard.stageRoute")}
      </div>
      <div className="text-xl font-bold text-gray-900 mb-1">{Math.round(recommended.travel_time_hours)} {t("common.hours")}</div>
      <div className="text-sm text-gray-600 mb-2">{t("dashboard.travelWord")} {money(recommended.transport_cost_total)}</div>
      <p className="text-sm font-semibold text-brand-700 mt-1 flex-1">
        {t("dashboard.viewBestRoute")}
      </p>
    </div>
  );
}

// ---- Alerts, notification-style row ----------------------------------------
function AlertsRow({ alerts }) {
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          {a.emoji && <span className="mt-0.5">{a.emoji}</span>}
          <span className="text-gray-700">{a.text}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Sell/store: real outcome recording ------------------------------------
function SellRecordModal({ t, batch, recommended, destinations, onClose, onSaved }) {
  const options = destinations?.length ? destinations : (recommended ? [recommended] : []);
  const [destinationId, setDestinationId] = useState(recommended?.destination_id ?? options[0]?.destination_id ?? "");
  const chosen = options.find((d) => d.destination_id === destinationId) || null;

  const [price, setPrice] = useState(chosen ? String(chosen.expected_price) : "");
  const [qtySold, setQtySold] = useState(batch.quantity_kg);
  const [qtySpoiled, setQtySpoiled] = useState(0);
  const [transportCost, setTransportCost] = useState(chosen ? Math.round(chosen.transport_cost_total) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  function handleDestinationChange(id) {
    const num = Number(id);
    setDestinationId(num);
    const d = options.find((o) => o.destination_id === num);
    if (d) {
      setPrice(String(d.expected_price));
      setTransportCost(Math.round(d.transport_cost_total));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!price || !qtySold) { setErr(t("common.genericError")); return; }
    setSaving(true);
    setErr(null);
    try {
      await api.markBatchSold(batch.id, {
        actual_price_per_kg: Number(price),
        actual_quantity_sold_kg: Number(qtySold),
        actual_quantity_spoiled_kg: Number(qtySpoiled) || 0,
        actual_transport_cost: transportCost === "" ? undefined : Number(transportCost),
        sold_destination_name: chosen?.name || undefined,
        sold_destination_id: chosen?.destination_id || undefined,
      });
      onSaved();
    } catch {
      setErr(t("common.genericError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">{t("dashboard.recordSaleTitle")}</h2>
        <p className="text-xs text-gray-500">{t("dashboard.recordSaleSubtitle")}</p>

        {options.length > 0 && (
          <label className="block text-xs font-semibold text-gray-600">
            {t("dashboard.soldWhereLabel")}
            <select value={destinationId} onChange={(e) => handleDestinationChange(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:border-brand-600 bg-white">
              {options.map((d) => (
                <option key={d.destination_id} value={d.destination_id}>
                  {d.name} — ₹{d.expected_price}/kg{d.price_source === "LIVE_AGMARKNET" ? ` (${t("dashboard.liveMandiPrice")})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {chosen && (
          <p className="text-[11px] text-gray-500 -mt-2">
            {chosen.price_source === "LIVE_AGMARKNET"
              ? t("dashboard.priceIsLive")
              : t("dashboard.priceIsDemo")}
          </p>
        )}

        <label className="block text-xs font-semibold text-gray-600">
          {t("dashboard.actualPriceLabel")}
          <input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:border-brand-600" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-gray-600">
            {t("dashboard.actualQtySoldLabel")}
            <input type="number" min="0" step="0.1" required value={qtySold} onChange={(e) => setQtySold(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:border-brand-600" />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            {t("dashboard.actualQtySpoiledLabel")}
            <input type="number" min="0" step="0.1" value={qtySpoiled} onChange={(e) => setQtySpoiled(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:border-brand-600" />
          </label>
        </div>
        <label className="block text-xs font-semibold text-gray-600">
          {t("dashboard.actualTransportCostLabel")}
          <input type="number" min="0" step="1" value={transportCost} onChange={(e) => setTransportCost(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:border-brand-600" />
        </label>
        {err && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-brand-700 text-white text-sm font-bold rounded-xl hover:bg-brand-800 disabled:opacity-50">
            {saving ? t("common.loading") : t("dashboard.recordSaleButton")}
          </button>
          <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50">
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- Quick actions, compact link row ---------------------------------------
function QuickActions({ t, navigate, onSellOrStore, batchSold }) {
  const actions = [
    { Icon: IconLeaf, title: t("dashboard.quickCheckCrop"), onClick: () => navigate("/batch-analysis") },
    { Icon: IconRoute, title: t("dashboard.quickFindMarket"), onClick: () => navigate("/destination-optimizer") },
    { Icon: IconTruck, title: t("dashboard.quickPlanRoute"), onClick: () => navigate("/route-planner") },
    { Icon: IconWarehouse, title: batchSold ? t("dashboard.alreadySold") : t("dashboard.quickSellStore"), onClick: onSellOrStore, disabled: batchSold },
  ];
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {actions.map((a) => (
        <button
          key={a.title}
          onClick={a.onClick}
          disabled={a.disabled}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-brand-700 disabled:opacity-40 disabled:hover:text-gray-600"
        >
          <a.Icon width={16} height={16} />
          {a.title}
        </button>
      ))}
    </div>
  );
}

// ---- Recent harvests table --------------------------------------------------
function ResultCell({ t, r }) {
  if (r.status !== "sold") return <span className="text-gray-400">—</span>;
  if (r.actual_net_value == null) return <span className="text-gray-400">—</span>;
  if (r.predicted_net_value == null) {
    return <span className="font-semibold text-gray-700">{money(r.actual_net_value)}</span>;
  }
  const diff = r.actual_net_value - r.predicted_net_value;
  const good = diff >= 0;
  return (
    <span className={`font-semibold ${good ? "text-brand-700" : "text-red-600"}`}>
      {good ? "+" : ""}{money(diff)} {t(good ? "dashboard.vsPredictedUp" : "dashboard.vsPredictedDown")}
    </span>
  );
}

function RecentHarvestsTable({ t, rows, navigate }) {
  return (
    <div id="recent-harvests">
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t("dashboard.recentHarvestsTitle")}</div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-semibold">{t("dashboard.cropCol")}</th>
              <th className="pb-2 font-semibold">{t("dashboard.quantityCol")}</th>
              <th className="pb-2 font-semibold">{t("dashboard.riskCol")}</th>
              <th className="pb-2 font-semibold">{t("dashboard.estimatedGoodFor")}</th>
              <th className="pb-2 font-semibold">{t("dashboard.marketCol")}</th>
              <th className="pb-2 font-semibold">{t("dashboard.statusCol")}</th>
              <th className="pb-2 font-semibold">{t("dashboard.resultCol")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => navigate("/batch-analysis")}>
                <td className="py-2.5 font-semibold text-gray-800 capitalize">{t(`crops.${r.crop_type}`, r.crop_type)}</td>
                <td className="py-2.5 text-gray-600">{r.quantity_kg.toLocaleString("en-IN")} {t("common.kg")}</td>
                <td className="py-2.5">
                  {r.latest_risk_label ? (
                    <span className="font-semibold" style={{ color: riskColor(r.latest_risk_label) }}>{riskLabelText(t, r.latest_risk_label)}</span>
                  ) : <span className="text-gray-400">{t("dashboard.notAssessed")}</span>}
                </td>
                <td className="py-2.5 text-gray-600">
                  {r.status === "sold"
                    ? (r.actual_price_per_kg != null ? `₹${r.actual_price_per_kg}/${t("common.kg")}` : "—")
                    : (r.goodForDays != null ? `~${t("common.dayCount", { count: r.goodForDays })}` : "—")}
                </td>
                <td className="py-2.5 text-gray-600">{r.marketName || "—"}</td>
                <td className="py-2.5 text-gray-500">{r.status === "sold" ? t("dashboard.sold") : t("dashboard.statusInProgress")}</td>
                <td className="py-2.5"><ResultCell t={t} r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.id} className="py-3" onClick={() => navigate("/batch-analysis")}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 capitalize">{t(`crops.${r.crop_type}`, r.crop_type)}</span>
              <span className="text-xs text-gray-500">{r.status === "sold" ? t("dashboard.sold") : t("dashboard.statusInProgress")}</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{r.quantity_kg.toLocaleString("en-IN")} {t("common.kg")} &middot; {r.marketName || "—"}</div>
            <div className="text-xs mt-1">
              {r.latest_risk_label ? (
                <span className="font-semibold" style={{ color: riskColor(r.latest_risk_label) }}>{riskLabelText(t, r.latest_risk_label)}</span>
              ) : <span className="text-gray-400">{t("dashboard.notAssessed")}</span>}
              {r.status === "sold"
                ? (r.actual_price_per_kg != null && <span className="text-gray-400"> &middot; ₹{r.actual_price_per_kg}/{t("common.kg")}</span>)
                : (r.goodForDays != null && <span className="text-gray-400"> &middot; ~{t("common.dayCount", { count: r.goodForDays })}</span>)}
            </div>
            {r.status === "sold" && <div className="text-xs mt-1"><ResultCell t={t} r={r} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Predicted vs actual + Value protected, paired typography row ---------
function OutcomesRow({ t, predictedVsActual, valueUplift }) {
  return (
    <div className="grid sm:grid-cols-2 gap-8">
      <div>
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("dashboard.predictedVsActualTitle")}</div>
        {predictedVsActual?.has_actual_outcome ? (
          <div className="space-y-1.5">
            {predictedVsActual.actual_price_per_kg != null && (
              <div className="text-sm text-gray-600">
                {t("dashboard.soldAtRate")}: <span className="font-semibold text-gray-700 tabular-nums">₹{predictedVsActual.actual_price_per_kg}/{t("common.kg")}</span>
                {predictedVsActual.sold_destination_name && <span className="text-gray-400"> · {predictedVsActual.sold_destination_name}</span>}
              </div>
            )}
            <div className="text-sm text-gray-600">{t("dashboard.predictedNetValue")}: <span className="font-semibold text-gray-700 tabular-nums">{predictedVsActual.predicted_net_value != null ? money(predictedVsActual.predicted_net_value) : "—"}</span></div>
            <div className="text-sm text-gray-900 font-bold">{t("dashboard.actualNetValue")}: <span className="text-brand-800 tabular-nums">{predictedVsActual.actual_net_value != null ? money(predictedVsActual.actual_net_value) : "—"}</span></div>
            {predictedVsActual.predicted_net_value != null && predictedVsActual.actual_net_value != null && (
              <p className="text-xs text-gray-500 pt-1">
                {t("dashboard.predictionDifference", {
                  amount: Math.abs(Math.round(predictedVsActual.actual_net_value - predictedVsActual.predicted_net_value)).toLocaleString("en-IN"),
                  direction: predictedVsActual.actual_net_value >= predictedVsActual.predicted_net_value ? t("dashboard.higherThanPredicted") : t("dashboard.lowerThanPredicted"),
                })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("dashboard.predictedVsActualEmpty")}</p>
        )}
      </div>
      <div>
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("dashboard.valueProtectedTitle")}</div>
        {valueUplift ? (
          <>
            <div className="text-2xl font-bold text-brand-800">{money(valueUplift.uplift_total)}</div>
            <p className="text-sm text-gray-500 mt-1">{t("dashboard.valueProtectedBody", { market: valueUplift.nearest_destination_name })}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">{t("dashboard.valueProtectedEmpty")}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { loadDemoBatch, isDemo, batch: sessionBatch } = useAppData();

  const [batches, setBatches] = useState(null);
  const [alertBatch, setAlertBatch] = useState(null);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState(null);
  const [risk, setRisk] = useState(null);
  const [destResult, setDestResult] = useState(null);
  const [recentRows, setRecentRows] = useState([]);
  const [showSellModal, setShowSellModal] = useState(false);
  const [predictedVsActual, setPredictedVsActual] = useState(null);

  async function handleLoadDemo() {
    setRouting(true);
    setError(null);
    try {
      await loadDemoBatch();
      navigate("/batch-analysis");
    } catch (e) {
      setError(t("common.genericError"));
    } finally {
      setRouting(false);
    }
  }

  useEffect(() => {
    api.getBatches().then(setBatches).catch(() => setError(t("common.genericError")));
  }, []);

  useEffect(() => {
    if (!batches || batches.length === 0) { setAlertBatch(null); return; }
    const current = batches[0];
    setAlertBatch(current);
    api.getPredictedVsActual(current.id).then(setPredictedVsActual).catch(() => setPredictedVsActual(null));
    let cancelled = false;

    // The current batch's own risk + destinations drive almost every card
    // above the fold, so they're requested (and awaited) first -- the
    // backend's dev server handles one request at a time, so anything fired
    // alongside them would otherwise compete for the same queue and delay
    // the primary view behind low-priority "recent batches" table lookups.
    Promise.all([
      api.getBatchRisk(current.id).catch(() => null),
      api.getBatchDestinations(current.id).catch(() => null),
    ]).then(([riskResult, destResultLocal]) => {
      if (cancelled) return;
      setRisk(riskResult);
      setDestResult(destResultLocal);

      const others = batches.slice(1, RECENT_LIMIT);
      const currentRow = {
        ...current,
        goodForDays: riskResult?.estimated_remaining_shelf_life_days != null ? Math.round(riskResult.estimated_remaining_shelf_life_days) : null,
        marketName: current.status === "sold" ? (current.sold_destination_name || null) : (destResultLocal?.destinations?.[0]?.name || null),
      };
      Promise.all(
        others.map((b) =>
          b.status === "sold"
            ? Promise.resolve({ ...b, goodForDays: null, marketName: b.sold_destination_name || null })
            : Promise.all([
                api.getBatchRisk(b.id).catch(() => null),
                api.getBatchDestinations(b.id).catch(() => null),
              ]).then(([r, d]) => ({
                ...b,
                goodForDays: r?.estimated_remaining_shelf_life_days != null ? Math.round(r.estimated_remaining_shelf_life_days) : null,
                marketName: d?.destinations?.[0]?.name || null,
              }))
        )
      ).then((rows) => { if (!cancelled) setRecentRows([currentRow, ...rows]); });
    });

    return () => { cancelled = true; };
  }, [batches]);

  const recommended = destResult?.destinations?.[0] || null;
  const saferOption = useMemo(() => {
    if (!destResult?.destinations || destResult.destinations.length < 2) return null;
    const lowest = [...destResult.destinations].sort((a, b) => a.arrival_risk_score - b.arrival_risk_score)[0];
    return lowest.destination_id !== recommended?.destination_id ? lowest : null;
  }, [destResult, recommended]);

  const emergency = useMemo(() => {
    if (!risk || !recommended) return false;
    const shelfLifeHours = risk.estimated_remaining_shelf_life_hours;
    return (shelfLifeHours != null && shelfLifeHours < recommended.travel_time_hours) || recommended.arrival_risk_label === "High";
  }, [risk, recommended]);

  const journeyStages = useMemo(() => {
    const checked = risk != null;
    const marketChosen = recommended != null;
    const sold = alertBatch?.status === "sold";
    // "Route" and "Sale" are two distinct real steps (plan the route, then
    // actually record the sale) -- once a market is chosen but before the
    // batch is marked sold, the farmer is on "Route": still free to plan/
    // adjust it, so it stays clickable straight through to the point of sale.
    return [
      { key: "harvested", Icon: IconLeaf, label: t("dashboard.stageHarvested"), done: true, current: false },
      { key: "checked", Icon: IconGauge, label: t("dashboard.stageChecked"), done: checked, current: !checked,
        suggestion: !checked ? t("dashboard.suggestCheckCrop") : null, actionLabel: t("dashboard.quickCheckCrop"), onAction: () => navigate("/batch-analysis") },
      { key: "risk", Icon: IconAlertTriangle, label: t("dashboard.stageRisk"), done: checked, current: false },
      { key: "market", Icon: IconTag, label: t("dashboard.stageMarket"), done: marketChosen, current: checked && !marketChosen,
        suggestion: checked && !marketChosen ? t("dashboard.suggestChooseMarket") : null, actionLabel: t("dashboard.quickFindMarket"), onAction: () => navigate("/destination-optimizer") },
      { key: "route", Icon: IconTruck, label: t("dashboard.stageRoute"), done: sold, current: marketChosen && !sold,
        suggestion: marketChosen && !sold ? t("dashboard.suggestPlanRoute") : null, actionLabel: t("dashboard.quickPlanRoute"), onAction: () => navigate("/route-planner") },
      { key: "sale", Icon: IconTrendingUp, label: t("dashboard.stageSale"), done: sold, current: false },
    ];
  }, [risk, recommended, alertBatch, t, navigate]);

  const alerts = useMemo(() => {
    const list = [];
    if (!risk || !recommended) return list;
    if (emergency) {
      list.push({ emoji: "", text: t("dashboard.alertHighRiskArrival") });
    } else if (risk.risk_label === "High" && risk.explanation?.reasons?.[0]?.factor === "temperature") {
      list.push({ emoji: "", text: t("dashboard.alertTempRisk") });
    } else {
      list.push({ emoji: "", text: t("dashboard.alertSafeWindow") });
    }
    return list;
  }, [risk, recommended, emergency, t]);

  async function handleSaleRecorded() {
    setShowSellModal(false);
    const [fresh, pva] = await Promise.all([
      api.getBatches(),
      api.getPredictedVsActual(alertBatch.id).catch(() => null),
    ]);
    setBatches(fresh);
    setPredictedVsActual(pva);
  }

  function scrollToBatches() {
    document.getElementById("recent-harvests")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (error) return <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>;
  if (batches === null) return <div className="text-sm text-gray-400">{t("common.loading")}</div>;

  const hasBatches = batches.length > 0;
  const isDemoBatch = isDemo && sessionBatch != null && alertBatch != null && sessionBatch.id === alertBatch.id;
  const marketForValueSections = emergency && saferOption ? saferOption : recommended;

  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7";

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className={`${card} mb-6`}>
        <PageHeader t={t} onCheckCrop={() => navigate("/batch-analysis")} onViewBatches={scrollToBatches} hasBatches={hasBatches} />
      </div>

      {!hasBatches && (
        <div className={`${card} text-center py-12`}>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t("dashboard.emptyStateTitle")}</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">{t("dashboard.emptyStateBody")}</p>
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <button onClick={() => navigate("/batch-analysis")} className="px-7 py-3.5 bg-brand-700 text-white text-sm font-bold rounded-xl hover:bg-brand-800 transition-colors">
              {t("dashboard.checkFirstCrop")}
            </button>
            <button onClick={handleLoadDemo} disabled={routing} className="text-sm font-semibold text-gray-600 hover:text-brand-700 hover:underline underline-offset-4 disabled:opacity-50">
              {routing ? t("route.loadingDemo") : t("route.loadDemo")}
            </button>
          </div>
        </div>
      )}

      {hasBatches && alertBatch && (
        <div className="space-y-6">
          <div className={card}>
            <CurrentHarvestRow t={t} batch={alertBatch} isDemoBatch={isDemoBatch} />
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            <CropHealthCard t={t} risk={risk} navigate={navigate} />
            <MarketStrategyCard t={t} navigate={navigate} destinations={destResult?.destinations} recommended={recommended} />
            <TransportRouteCard t={t} navigate={navigate} recommended={recommended} />
          </div>

          {alerts.length > 0 && (
            <div className={card}>
              <AlertsRow alerts={alerts} />
            </div>
          )}

          <div className={card}>
            <QuickActions t={t} navigate={navigate} onSellOrStore={() => setShowSellModal(true)} batchSold={alertBatch.status === "sold"} />
          </div>

          {showSellModal && (
            <SellRecordModal t={t} batch={alertBatch} recommended={recommended} destinations={destResult?.destinations} onClose={() => setShowSellModal(false)} onSaved={handleSaleRecorded} />
          )}

          {recentRows.length > 0 && (
            <div className={card}>
              <RecentHarvestsTable t={t} rows={recentRows} navigate={navigate} />
            </div>
          )}

          <div className={card}>
            <OutcomesRow t={t} predictedVsActual={predictedVsActual} valueUplift={destResult?.value_uplift} />
          </div>
        </div>
      )}
    </div>
  );
}
