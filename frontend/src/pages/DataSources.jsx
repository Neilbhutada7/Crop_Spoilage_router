import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import MapView from "../components/MapView";

function Badge({ kind, label }) {
  const styles = {
    Verified: "bg-brand-50 text-brand-700 border-brand-200",
    Synthetic: "bg-amber-50 text-amber-700 border-amber-200",
    Benchmark: "bg-indigo-50 text-indigo-700 border-indigo-200",
    LiveFallback: "bg-teal-50 text-teal-700 border-teal-200",
  };
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles[kind]}`}>{label}</span>;
}

function SourceRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

export default function DataSources() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [destinations, setDestinations] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    api.getModelInfo().then(setInfo).catch(() => {});
    api.getDestinations().then(setDestinations).catch(() => {});
  }, []);

  const destCount = destinations?.length ?? null;

  const filteredDestinations = useMemo(() => {
    if (!destinations) return [];
    if (typeFilter === "all") return destinations;
    return destinations.filter((d) => d.type === typeFilter);
  }, [destinations, typeFilter]);

  const loadingText = t("common.loading");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("data.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("data.subtitle")}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800">{t("data.networkTitle")}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t("data.networkSubtitle")}</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { value: "all", label: `${t("data.all")} (${destCount ?? "…"})` },
              { value: "mandi", label: t("data.mandi") },
              { value: "storage_facility", label: t("data.storage") },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTypeFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${typeFilter === opt.value ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid lg:grid-cols-[1fr_320px]">
          <div className="h-[380px]">
            {destinations && <MapView destinations={filteredDestinations} farmLocation={null} />}
          </div>
          <div className="h-[380px] overflow-y-auto border-t lg:border-t-0 lg:border-l border-gray-100">
            {destinations === null && <p className="p-4 text-xs text-gray-400">{loadingText}</p>}
            {destinations && filteredDestinations.map((d) => (
              <div key={d.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{d.name}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${d.type === "mandi" ? "bg-pink-50 text-pink-600" : "bg-indigo-50 text-indigo-600"}`}>{d.type === "mandi" ? t("data.mandi") : t("data.storage")}</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{d.state} &middot; ₹{d.base_price_per_kg}/{t("common.kg")} &middot; {d.capacity_kg.toLocaleString("en-IN")} {t("common.kg")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t("data.cropDataset")}</h2>
          <Badge kind="Benchmark" label={t("data.benchmark")} />
        </div>
        <SourceRow label="Dataset name" value="fresh_produce_wastage_dataset.csv (real 3,000-row public benchmark, bundled with this repo)" />
        <SourceRow label="Records" value={info ? `${info.training.n_training_rows.toLocaleString("en-IN")} train / ${info.training.n_test_rows?.toLocaleString("en-IN") ?? "—"} test` : loadingText} />
        <SourceRow label="Features" value={info ? info.feature_columns.join(", ") : loadingText} />
        <SourceRow label="Model" value="XGBoost regressor trained on this dataset -- real MAE/R²/accuracy/precision/recall/F1/ROC-AUC on a held-out split, see Prediction Accuracy page" />
        <SourceRow label="Dataset provenance" value="Not independently verified as real-world observed farm outcomes -- treated as a benchmark dataset, not confirmed real data" />
        <SourceRow label="Crop-specific decay" value="The trained model alone barely differentiates by crop (dataset limitation); the live risk score blends it 50/50 with a literature-grounded Q10 + per-crop reference-shelf-life formula so crop identity meaningfully affects the score -- see Prediction Accuracy page" />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t("data.marketData")}</h2>
          <Badge kind="LiveFallback" label={t("data.liveFallback")} />
        </div>
        <SourceRow label="Destinations" value={destCount !== null ? `${destCount} real Maharashtra locations (Nashik / Pune / Nagpur)` : loadingText} />
        <SourceRow label="Live price source" value="Government of India Agmarknet daily mandi price feed (data.gov.in resource 9ef84268-...), fetched per state/crop and cached 6h" />
        <SourceRow label="Fallback price" value="30-day mean-reverting random walk per destination per crop, used only when Agmarknet has no matching record today" />
        <SourceRow label="Labeling" value="Every price is tagged LIVE_AGMARKNET, SEEDED_HISTORY, or SYNTHETIC_BASE in the API response — never blended or shown without its real source" />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t("data.weatherData")}</h2>
          <Badge kind="Verified" label={t("data.verified")} />
        </div>
        <SourceRow label="Provider" value="Open-Meteo (live API, no key required)" />
        <SourceRow label="Coverage" value="Live current conditions, 16-day forecast, 92-day historical archive" />
        <SourceRow label="Fallback" value="Clearly-labeled synthetic seasonal model, only outside that coverage window" />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t("data.logisticsData")}</h2>
          <Badge kind="Benchmark" label={t("data.benchmark")} />
        </div>
        <SourceRow label="Distance source" value="Real PostGIS ST_Distance spatial query over real town coordinates" />
        <SourceRow label="Routing source" value="Estimated (distance ÷ illustrative avg. road speed) — not a live routing/traffic API" />
        <SourceRow label="Destination locations" value="Real coordinates (Nashik, Pune, Nagpur)" />
        <SourceRow label="Storage capacity" value="Grounded in a real published national average — Ministry of Food Processing Industries/PIB: 8,186 cold storages, 374.25 lakh MT total capacity nationally (~4,572 MT/facility avg.) — not an arbitrary number" />
        <SourceRow label="Live occupancy" value="Genuinely synthetic — no public per-facility live occupancy feed exists in India (checked data.gov.in directly: only static state-level totals, no API). Labeled DEMO_AVAILABILITY, never shown as real-time" />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-1">{t("data.relatedSystemsTitle")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("data.relatedSystemsSubtitle")}</p>
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-800">eNAM</span>
            <span className="text-gray-500"> — {t("data.relatedEnam")}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-800">Ninjacart</span>
            <span className="text-gray-500"> — {t("data.relatedNinjacart")}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-800">DeHaat</span>
            <span className="text-gray-500"> — {t("data.relatedDehaat")}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-800">AgriBazaar</span>
            <span className="text-gray-500"> — {t("data.relatedAgribazaar")}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">{t("data.relatedDifferentiation")}</p>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
        {t("data.hackathonNote")}
      </p>
    </div>
  );
}
