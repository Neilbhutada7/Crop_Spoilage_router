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

// ---- Risk + remaining time, one connected panel --------------------------
function CropRightNowPanel({ t, risk }) {
  const color = riskColor(risk.risk_label);
  const topFactor = risk.explanation?.reasons?.[0];
  const topFactorLabel = topFactor
    ? { temperature: t("batch.temperature"), humidity: t("batch.humidity"), days_since_harvest: t("dashboard.timeSinceHarvest") }[topFactor.factor]
    : null;
  const days = Math.max(0, Math.round(risk.estimated_remaining_shelf_life_days));

  return (
    <div>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t("dashboard.cropHealthTitle")}</div>

      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-bold tabular-nums" style={{ color }}>{Math.round(risk.risk_score)}%</span>
        <span className="text-lg font-semibold" style={{ color }}>{riskLabelText(t, risk.risk_label)}</span>
      </div>

      <div className="mt-4 max-w-md">
        <div className="relative h-1.5 bg-gray-200 rounded-full">
          <div className="absolute -top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm" style={{ left: `calc(${Math.min(100, risk.risk_score)}% - 7px)`, background: color }} />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-gray-400 mt-1.5">
          <span>{t("risk.low")}</span>
          <span>{t("risk.high")}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-3 mt-6 text-sm">
        <div>
          <div className="text-gray-400">{t("batch.temperature")}</div>
          <div className="font-semibold text-gray-900 mt-0.5">{risk.temperature_c}&deg;C</div>
        </div>
        <div>
          <div className="text-gray-400">{t("batch.humidity")}</div>
          <div className="font-semibold text-gray-900 mt-0.5">{risk.humidity_pct}%</div>
        </div>
        <div>
          <div className="text-gray-400">{t("batch.age")}</div>
          <div className="font-semibold text-gray-900 mt-0.5">{risk.days_since_harvest === 0 ? t("common.today") : t("common.dayCount", { count: risk.days_since_harvest })}</div>
        </div>
      </div>

      {topFactorLabel && (
        <p className="text-sm text-gray-500 mt-4">{t("dashboard.biggestFactor", { factor: topFactorLabel })}</p>
      )}

      <div className="mt-7 pt-6 border-t border-gray-100">
        {risk.shelf_life_estimate_capped && risk.risk_label !== "Low" ? (
          // capped means the model's OWN risk score plateaus below the High
          // threshold rather than actually improving -- at Medium/High risk
          // that's a flat, still-elevated number, not "days of good time
          // left". Framing it as a day-count here would contradict the risk
          // gauge shown just above.
          <>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("dashboard.riskStaysElevatedTitle")}</div>
            <div className="text-2xl font-bold text-gray-900">{t("dashboard.riskStaysElevated", { score: Math.round(risk.risk_score) })}</div>
            <p className="text-sm text-gray-500 mt-1">{t("dashboard.riskStaysElevatedSubtitle")}</p>
          </>
        ) : (
          <>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("dashboard.remainingTimeTitle")}</div>
            <div className="text-2xl font-bold text-gray-900">{t(risk.shelf_life_estimate_capped ? "dashboard.moreThanDays" : "dashboard.aboutDays", { days, count: days })}</div>
            <p className="text-sm text-gray-500 mt-1">{t("dashboard.remainingTimeSubtitle")}</p>
            <div className="flex items-center gap-2 mt-3 max-w-xs">
              <span className="text-[11px] font-semibold text-gray-400 shrink-0">{t("common.today")}</span>
              <div className="flex-1 h-px bg-gray-300 relative">
                <div className="absolute -top-[3px] right-0 w-2 h-2 rounded-full bg-brand-700" />
              </div>
              <span className="text-[11px] font-semibold text-gray-400 shrink-0">~{days}{t("common.days")[0]}</span>
            </div>
          </>
        )}
        <p className="text-[11px] text-gray-400 mt-2">{t("dashboard.benchmarkEstimateNote")}</p>
      </div>
    </div>
  );
}

// ---- Hero recommendation --------------------------------------------------
function RecommendationHero({ t, navigate, risk, recommended, emergency, saferOption, destinations }) {
  const [showWhy, setShowWhy] = useState(false);
  const label = risk.risk_label;
  const stateInfo = emergency
    ? { color: "#dc2626", tint: "#fef2f2", Icon: IconZap, title: t("dashboard.actSoonTitle"), body: t("dashboard.emergencyBody") }
    : label === "High"
    ? { color: "#dc2626", tint: "#fef2f2", Icon: IconZap, title: t("dashboard.actSoonTitle"), body: t("dashboard.actSoonBody") }
    : label === "Medium"
    ? { color: "#c9711a", tint: "#fdf5ec", Icon: IconClock, title: t("dashboard.attentionTitle"), body: t("dashboard.attentionBody") }
    : { color: "#1a4f31", tint: "#eef7f0", Icon: IconCheck, title: t("dashboard.sellSoonTitle"), body: t("dashboard.sellSoonBody") };

  const market = emergency && saferOption ? saferOption : recommended;

  const whyReasons = useMemo(() => {
    if (!market || !destinations?.length) return [];
    const others = destinations.filter((d) => d.destination_id !== market.destination_id);
    const reasons = [];
    if (others.length === 0 || market.travel_time_hours <= Math.min(...others.map((o) => o.travel_time_hours)))
      reasons.push(t("dashboard.whyLowerTravel"));
    if (others.length === 0 || market.expected_spoilage_loss <= Math.min(...others.map((o) => o.expected_spoilage_loss)))
      reasons.push(t("dashboard.whyLowerSpoilage"));
    if (risk.estimated_remaining_shelf_life_hours != null && market.travel_time_hours <= risk.estimated_remaining_shelf_life_hours)
      reasons.push(t("dashboard.whySuitableTime"));
    reasons.push(t("dashboard.whyBetterMoney"));
    return reasons;
  }, [market, destinations, risk, t]);

  return (
    <div className="rounded-2xl border-l-[5px] shadow-sm px-6 sm:px-7 py-7" style={{ background: stateInfo.tint, borderColor: stateInfo.color, borderTop: `1px solid ${stateInfo.color}22`, borderRight: `1px solid ${stateInfo.color}22`, borderBottom: `1px solid ${stateInfo.color}22` }}>
      <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: stateInfo.color }}>{t("dashboard.whatShouldYouDoNow")}</div>
      <h2 className="text-[26px] font-bold mb-2" style={{ color: stateInfo.color }}>{stateInfo.title}</h2>
      <p className="text-[15px] text-gray-700 mb-6 max-w-xl">{stateInfo.body}</p>

      {market && (
        <>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            {emergency ? t("dashboard.betterOptionLabel") : t("dashboard.recommendedMarketLabel")}
          </div>
          <div className="text-xl font-bold text-gray-900 mb-1.5">{market.name}</div>
          <p className="text-sm text-gray-600">
            {Math.round(market.travel_time_hours)} {t("common.hours")}
            {" · "}{money(market.transport_cost_total)} {t("dashboard.travelWord")}
            {" · "}{Math.round(market.arrival_risk_score)}% {t("dashboard.riskOnArrival")}
          </p>

          <div className="mt-5">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t("dashboard.moneyAfterCosts")}</div>
            <div className="text-3xl font-bold text-gray-900 mt-0.5">{money(market.expected_realised_value)}</div>
          </div>

          <div className="flex flex-wrap items-center gap-5 mt-6">
            <button
              onClick={() => navigate("/route-planner")}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-700 text-white text-sm font-bold rounded-xl hover:bg-brand-800 transition-colors"
            >
              {emergency ? t("dashboard.findSaferOption") : t("dashboard.viewBestRoute")} <IconChevronRight width={16} height={16} />
            </button>
            <button
              onClick={() => navigate("/destination-optimizer")}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 hover:underline underline-offset-4"
            >
              {t("dashboard.seeOtherMarkets")}
            </button>
          </div>

          {whyReasons.length > 0 && (
            <div className="mt-5 pt-5 border-t" style={{ borderColor: `${stateInfo.color}22` }}>
              <button onClick={() => setShowWhy((v) => !v)} className="text-sm font-semibold text-gray-600 hover:text-gray-900">
                {t("dashboard.whyThisOption")} {showWhy ? "−" : "+"}
              </button>
              {showWhy && (
                <ul className="mt-3 space-y-1.5">
                  {whyReasons.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <IconCheck width={14} height={14} className="mt-1 shrink-0 text-brand-600" /> {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Sell vs Store ---------------------------------------------------------
function SellVsStore({ t, navigate, destinations, risk }) {
  const data = useMemo(() => {
    if (!destinations?.length) return null;
    const mandis = destinations.filter((d) => d.type === "mandi");
    const storages = destinations.filter((d) => d.type === "storage_facility");
    const bestMandi = mandis.length ? [...mandis].sort((a, b) => b.expected_realised_value - a.expected_realised_value)[0] : null;
    const bestStorage = storages.length ? [...storages].sort((a, b) => b.expected_realised_value - a.expected_realised_value)[0] : null;
    if (!bestMandi && !bestStorage) return null;
    const sellWins = bestMandi && (!bestStorage || bestMandi.expected_realised_value >= bestStorage.expected_realised_value);
    return { bestMandi, bestStorage, sellWins };
  }, [destinations]);

  if (!data) return null;
  const { bestMandi, bestStorage, sellWins } = data;
  const storeDays = Math.max(0, Math.round(risk.estimated_remaining_shelf_life_days));

  return (
    <div>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">{t("dashboard.sellVsStoreTitle")}</div>
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        <div className="sm:pr-8 pb-5 sm:pb-0">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t("dashboard.sellNowLabel")}</div>
          {bestMandi ? (
            <>
              <div className="text-2xl font-bold text-gray-900">{money(bestMandi.expected_realised_value)}</div>
              <p className="text-sm text-gray-500 mt-1">{bestMandi.name} · {Math.round(bestMandi.travel_time_hours)} {t("common.hours")} · {Math.round(bestMandi.arrival_risk_score)}% {t("dashboard.riskOnArrival")}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">{t("dashboard.noMandiNearby")}</p>
          )}
        </div>
        <div className="sm:pl-8 pt-5 sm:pt-0">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t("dashboard.storeLabel")}</div>
          {bestStorage ? (
            <>
              <div className="text-2xl font-bold text-gray-900">{money(bestStorage.expected_realised_value)}</div>
              <p className="text-sm text-gray-500 mt-1">{bestStorage.name} · {t(risk.shelf_life_estimate_capped ? "dashboard.moreThanDays" : "dashboard.aboutDays", { days: storeDays, count: storeDays })} · {Math.round(bestStorage.arrival_risk_score)}% {t("dashboard.riskOnArrival")}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">{t("dashboard.noStorageNearby")}</p>
          )}
        </div>
      </div>
      <p className="text-sm mt-5">
        <span className="font-bold text-gray-900">{t("dashboard.recommendedColon")}</span>{" "}
        <span className="text-brand-700 font-semibold">
          {sellWins
            ? t("dashboard.sellNowLabel")
            : risk.shelf_life_estimate_capped && risk.risk_label !== "Low"
            ? t("dashboard.storeWhileElevated")
            : t(risk.shelf_life_estimate_capped ? "dashboard.storeForDaysCapped" : "dashboard.storeForDays", { days: storeDays, count: storeDays })}
        </span>
      </p>
    </div>
  );
}

// ---- Crop journey, minimal timeline ---------------------------------------
function CropJourney({ t, stages, predictedVsActual }) {
  const currentStage = stages.find((s) => s.current);
  const soldStage = stages.find((s) => s.key === "sale" && s.done);

  // Real recorded outcome, not a prediction: quantity the farmer actually
  // reported as spoiled x the actual price they got. If they recorded zero
  // spoiled, this is honestly ₹0 -- never forced to zero, just what
  // happened when no spoilage occurred.
  const actualLoss = soldStage && predictedVsActual?.has_actual_outcome
    && predictedVsActual.actual_quantity_spoiled_kg != null && predictedVsActual.actual_price_per_kg != null
    ? predictedVsActual.actual_quantity_spoiled_kg * predictedVsActual.actual_price_per_kg
    : null;

  return (
    <div>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-5">{t("dashboard.journeyTitle")}</div>
      <div className="flex items-start overflow-x-auto pb-1">
        {stages.map((s, i) => {
          const StageIcon = s.Icon;
          const clickable = s.current && s.onAction;
          return (
            <div key={s.key} className={`flex items-center ${i < stages.length - 1 ? "flex-1" : "shrink-0"}`}>
              <button
                type="button"
                onClick={clickable ? s.onAction : undefined}
                disabled={!clickable}
                className={`flex flex-col items-center gap-1.5 w-16 sm:w-20 shrink-0 ${clickable ? "cursor-pointer group" : "cursor-default"}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    s.done
                      ? "bg-brand-700 text-white"
                      : s.current
                      ? "border-2 border-brand-700 text-brand-700 bg-white group-hover:bg-brand-50"
                      : "border border-gray-200 text-gray-300 bg-white"
                  }`}
                >
                  {s.done ? <IconCheck width={13} height={13} /> : <StageIcon width={13} height={13} />}
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight ${s.done ? "text-gray-600" : s.current ? "text-brand-700" : "text-gray-300"}`}>{s.label}</span>
              </button>
              {i < stages.length - 1 && <div className={`flex-1 min-w-[16px] h-px mb-5 ${s.done ? "bg-brand-700" : "bg-gray-200"}`} />}
            </div>
          );
        })}
      </div>

      {currentStage?.suggestion && (
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">{currentStage.suggestion}</p>
          {currentStage.onAction && (
            <button onClick={currentStage.onAction} className="text-sm font-semibold text-brand-700 hover:underline underline-offset-4 shrink-0">
              {currentStage.actionLabel} →
            </button>
          )}
        </div>
      )}

      {actualLoss != null && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("dashboard.actualLossTitle")}</div>
          <div className={`text-xl font-bold ${actualLoss > 0 ? "text-red-600" : "text-brand-700"}`}>{money(actualLoss)}</div>
          <p className="text-sm text-gray-500 mt-1">
            {actualLoss > 0 ? t("dashboard.actualLossBody", { kg: predictedVsActual.actual_quantity_spoiled_kg }) : t("dashboard.actualLossZeroBody")}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- Value at risk + Weather, paired typography row -----------------------
function ValueAtRiskAndWeather({ t, market, risk }) {
  return (
    <div className="grid sm:grid-cols-2 gap-8">
      <div>
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("dashboard.valueAtRiskTitle")}</div>
        <div className="text-2xl font-bold text-red-600">{money(market.expected_spoilage_loss)}</div>
        <p className="text-sm text-gray-500 mt-1">{t("dashboard.valueAtRiskCaption")}</p>
        <div className="text-sm text-gray-500 mt-3 space-y-1">
          <div>{t("market.travelCost")}: <span className="text-gray-700 font-medium">{money(market.transport_cost_total)}</span></div>
          <div>{t("dashboard.moneyAfterCosts")}: <span className="text-gray-700 font-medium">{money(market.expected_realised_value)}</span></div>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t("dashboard.weatherTitle")}</div>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${risk.weather_is_synthetic ? "text-gray-400" : "text-brand-700"}`}>
            {risk.weather_is_synthetic ? t("dashboard.demoWeatherLabel") : t("dashboard.liveWeatherLabel")}
          </span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{risk.temperature_c}&deg;C · {risk.humidity_pct}%</div>
        <p className="text-sm text-gray-500 mt-1">
          {risk.temperature_c >= 28 ? t("dashboard.weatherWarmNote") : t("dashboard.weatherNormalNote")}
        </p>
      </div>
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

          {risk ? (
            <div className={card}>
              <CropRightNowPanel t={t} risk={risk} />
            </div>
          ) : (
            <div className={`${card} text-sm text-gray-400`}>{t("common.loading")}</div>
          )}

          {risk && recommended && (
            <RecommendationHero t={t} navigate={navigate} risk={risk} recommended={recommended} emergency={emergency} saferOption={saferOption} destinations={destResult?.destinations} />
          )}

          {risk && destResult?.destinations?.length > 0 && (
            <div className={card}>
              <SellVsStore t={t} navigate={navigate} destinations={destResult.destinations} risk={risk} />
            </div>
          )}

          <div className={card}>
            <CropJourney t={t} stages={journeyStages} predictedVsActual={predictedVsActual} />
          </div>

          {risk && marketForValueSections && (
            <div className={card}>
              <ValueAtRiskAndWeather t={t} market={marketForValueSections} risk={risk} />
            </div>
          )}

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
