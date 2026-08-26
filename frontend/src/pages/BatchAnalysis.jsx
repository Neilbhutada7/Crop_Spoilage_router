import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppData } from "../AppDataContext";
import { useDisplayMode } from "../DisplayModeContext";
import { riskColor } from "../colors";
import { IconThermometer, IconDroplet, IconChevronRight, IconCalendar } from "../components/Icons";

const CROPS = ["tomato", "onion", "banana", "potato", "mango"];
const STORAGE_OPTIONS = ["open", "covered", "coldStorage", "controlled"];
const PACKAGING_OPTIONS = ["loose", "crate", "carton", "refrigerated"];

function todayIso() { return new Date().toISOString().slice(0, 10); }

function HorizontalRiskMeter({ score, label, text, legendLow, legendMedium, legendHigh, aboutWord }) {
  const color = riskColor(label);
  return (
    <div className="w-full mb-4">
      <div className="flex justify-between text-xs font-bold text-gray-400 mb-2">
        <span>{legendLow}</span>
        <span>{legendMedium}</span>
        <span>{legendHigh}</span>
      </div>
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
        <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <div className="mt-3 text-lg font-bold" style={{ color }}>
        {aboutWord} {Math.round(score)}% &mdash; {text}
      </div>
    </div>
  );
}

export default function BatchAnalysis() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { simple } = useDisplayMode();
  const { runBatch, risk } = useAppData();

  const [farmLocations, setFarmLocations] = useState([]);
  const [cropType, setCropType] = useState("tomato");
  const [harvestDate, setHarvestDate] = useState(todayIso());
  const [quantityKg, setQuantityKg] = useState(500);
  const [farmIndex, setFarmIndex] = useState(0);
  const [liveWeather, setLiveWeather] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    api.getFarmLocations().then(setFarmLocations).catch(() => setError(t("common.genericError")));
  }, []);

  useEffect(() => {
    if (farmLocations.length === 0) return;
    const farm = farmLocations[farmIndex];
    api.getWeather(farm.latitude, farm.longitude).then(setLiveWeather).catch(() => setLiveWeather(null));
  }, [farmLocations, farmIndex]);

  const harvestAgeDays = Math.max(0, Math.round((Date.now() - new Date(harvestDate).getTime()) / 86400000));

  async function handleUseCurrentLocation(e) {
    e.preventDefault();
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    const loadingName = "Locating...";
    setFarmLocations(prev => {
      const next = [...prev, { name: loadingName, latitude: 0, longitude: 0 }];
      setFarmIndex(next.length - 1);
      return next;
    });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let currentName = "Current Location";
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          if (data && data.address) {
            currentName = data.address.city || data.address.town || data.address.village || data.address.county || currentName;
          }
        } catch (e) {
          console.warn("Reverse geocoding failed", e);
        }

        setFarmLocations((prev) => {
          const cleaned = prev.filter(l => l.name !== loadingName);
          const existingIdx = cleaned.findIndex(l => l.name === currentName);
          if (existingIdx !== -1) {
            setFarmIndex(existingIdx);
            return cleaned;
          }
          const next = [...cleaned, { name: currentName, latitude, longitude }];
          setFarmIndex(next.length - 1);
          return next;
        });
      },
      (err) => {
        setFarmLocations(prev => {
          const cleaned = prev.filter(l => l.name !== loadingName);
          setFarmIndex(0);
          return cleaned;
        });
        alert("Could not get your location. Please check your browser permissions.");
      }
    );
  }

  async function handlePredict(e) {
    e.preventDefault();
    setError(null);
    if (!quantityKg || Number(quantityKg) <= 0) { setError(t("common.genericError")); return; }
    if (farmLocations.length === 0) { setError(t("common.loading")); return; }
    setSubmitting(true);
    try {
      const farm = farmLocations[farmIndex];
      await runBatch({
        crop_type: cropType,
        harvest_date: harvestDate,
        quantity_kg: Number(quantityKg),
        farm_latitude: farm.latitude,
        farm_longitude: farm.longitude,
        farm_name: farm.name,
      });
    } catch (err) {
      setError(t("common.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  const riskLabelText = risk ? (risk.risk_label === "Low" ? t("risk.low") : risk.risk_label === "Medium" ? t("risk.medium") : t("risk.high")) : "";

  // Real model-projection estimate (same trained model walked forward day
  // by day, see risk_service._model_projected_remaining_days) -- not a
  // client-side guess.
  const estimatedGoodFor = risk?.estimated_remaining_shelf_life_days != null
    ? Math.max(0, Math.round(risk.estimated_remaining_shelf_life_days))
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      
      {/* STEP 1 */}
      <section className="bg-white border border-brand-100 rounded-md p-6 shadow-card">
        <h2 className="text-xl font-bold text-gray-900 mb-5">{t("batch.title")}</h2>
        <form onSubmit={handlePredict} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <label className="block text-sm font-semibold text-gray-700">
              {t("batch.cropLabel")}
              <select value={cropType} onChange={(e) => setCropType(e.target.value)} className="mt-1.5 w-full px-4 py-3 border border-gray-300 rounded-md text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
                {CROPS.map((c) => <option key={c} value={c}>{t(`crops.${c}`)}</option>)}
              </select>
            </label>

            <label className="block text-sm font-semibold text-gray-700">
              {t("batch.quantityLabel")}
              <input type="number" min="1" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)}
                className="mt-1.5 w-full px-4 py-3 border border-gray-300 rounded-md text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            </label>

            <label className="block text-sm font-semibold text-gray-700">
              {t("batch.harvestAgeLabel")} <span className="text-gray-400 font-normal normal-case">({t("batch.harvestAgeHint", { days: harvestAgeDays })})</span>
              <input type="date" max={todayIso()} value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)}
                className="mt-1.5 w-full px-4 py-3 border border-gray-300 rounded-md text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            </label>

            <div className="block text-sm font-semibold text-gray-700">
              <div className="flex justify-between items-center">
                {t("batch.farmLocationLabel")}
                <button type="button" onClick={handleUseCurrentLocation} className="text-brand-600 hover:text-brand-700 text-xs font-bold">
                  Use Current Location
                </button>
              </div>
              <select value={farmIndex} onChange={(e) => setFarmIndex(Number(e.target.value))}
                disabled={farmLocations.length === 0}
                className="mt-1.5 w-full px-4 py-3 border border-gray-300 rounded-md text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-500">
                {farmLocations.length === 0 ? (
                  <option>Loading locations...</option>
                ) : (
                  farmLocations.map((f, i) => <option key={f.name} value={i}>{f.name}</option>)
                )}
              </select>
            </div>
          </div>

          <div className="bg-surface-light border border-earth-100 rounded-md p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-earth-600 uppercase tracking-wide mb-1">{t("batch.currentConditions")}</div>
              <div className="text-[11px] text-gray-500">{liveWeather?.is_synthetic ? t("batch.syntheticWeather") : t("batch.liveWeather")}</div>
            </div>
            {liveWeather ? (
              <div className="flex gap-5 text-base font-bold text-gray-800">
                <span className="flex items-center gap-1.5"><IconThermometer width={16} height={16} className="text-earth-500" /> {liveWeather.temperature_c}&deg;C</span>
                <span className="flex items-center gap-1.5"><IconDroplet width={16} height={16} className="text-brand-500" /> {liveWeather.humidity_pct}%</span>
              </div>
            ) : <div className="text-sm text-gray-400">{t("common.loading")}</div>}
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

          <button type="submit" disabled={submitting} className="w-full py-4 bg-brand-600 text-white text-base font-bold rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm">
            {submitting ? t("batch.submitting") : t("batch.submitButton")}
          </button>
        </form>
      </section>

      {risk && (
        <>
          {/* STEP 2 */}
          <section className="bg-white border border-brand-100 rounded-md p-6 shadow-card animate-enter">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t("batch.resultTitle")}</h2>
            <div className="border border-brand-50 rounded-md p-6 bg-surface-light mb-6 shadow-sm">
              <HorizontalRiskMeter
                score={risk.risk_score} label={risk.risk_label} text={riskLabelText}
                legendLow={t("risk.low")} legendMedium={t("risk.medium")} legendHigh={t("risk.high")}
                aboutWord={t("common.about")}
              />
              
              <div className="mt-4">
                <details className="text-sm text-gray-600 cursor-pointer">
                  <summary className="font-semibold text-brand-700 hover:underline outline-none">{t("batch.whyThisRisk")}</summary>
                  <div className="mt-3 pl-4 border-l-2 border-brand-200 space-y-2">
                    {risk.explanation?.reasons?.map((r, i) => (
                      <p key={i}>{r.text}</p>
                    ))}
                    <p className="text-xs text-gray-400 italic mt-2">{t("batch.whyThisRiskSubtitle")}</p>
                  </div>
                </details>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-gray-200 rounded-md p-3 flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-earth-50">
                  <IconThermometer width={17} height={17} className="text-earth-600" />
                </div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t("batch.temperature")}</div>
                <div className="text-lg font-bold text-gray-900">{risk.temperature_c}&deg;C</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-3 flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-brand-50">
                  <IconDroplet width={17} height={17} className="text-brand-600" />
                </div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t("batch.humidity")}</div>
                <div className="text-lg font-bold text-gray-900">{risk.humidity_pct}%</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-3 flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-gray-100">
                  <IconCalendar width={17} height={17} className="text-gray-500" />
                </div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t("batch.age")}</div>
                <div className="text-lg font-bold text-gray-900">{risk.days_since_harvest === 0 ? t("common.today") : t("common.dayCount", { count: risk.days_since_harvest })}</div>
              </div>
            </div>
          </section>

          {/* STEP 3 */}
          <section className="bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 rounded-md p-8 shadow-card animate-enter" style={{ animationDelay: '150ms' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("batch.whatShouldYouDo")}</h2>

            <div className="text-xl font-bold mt-4" style={{ color: riskColor(risk.risk_label) }}>
              {risk.risk_label === "High" ? t("batch.actionSellSoon") : risk.risk_label === "Medium" ? t("batch.actionConsiderOptions") : t("batch.actionSafeToStore")}
            </div>

            {estimatedGoodFor != null && (
              <p className="text-lg text-gray-800 mt-2 font-medium">
                {risk.shelf_life_estimate_capped && risk.risk_label !== "Low"
                  // capped means the model's OWN risk score never crosses the High
                  // threshold within the projection horizon -- but at Medium/High
                  // risk that's a plateau, not safety: the crop is already at
                  // risk.risk_score% right now and the model doesn't expect that
                  // to meaningfully improve. "Should remain good for N days" would
                  // misreport an already-elevated, flat risk as reassurance.
                  ? t("batch.riskStaysElevated", { score: Math.round(risk.risk_score) })
                  : t(risk.shelf_life_estimate_capped ? "batch.goodForBodyCapped" : "batch.goodForBody", { days: estimatedGoodFor, count: estimatedGoodFor })}
              </p>
            )}
            <p className="text-sm text-gray-600 mt-2">
              {risk.risk_label === "High" ? t("batch.resultHighText") : risk.risk_label === "Medium" ? t("batch.resultMediumText") : t("batch.resultLowText")}
            </p>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button onClick={() => navigate("/destination-optimizer")} className="flex-1 py-4 px-6 bg-brand-700 text-white text-lg font-bold rounded-md hover:bg-brand-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                {t("batch.findBestDestination")} <IconChevronRight width={18} height={18} />
              </button>
              <button onClick={() => setShowTechnical(!showTechnical)} className="py-4 px-6 bg-white text-gray-700 border border-gray-300 text-sm font-bold rounded-md hover:bg-gray-50 transition-colors shadow-sm">
                {t("batch.technicalDetails")}
              </button>
            </div>
          </section>

          {/* ADVANCED */}
          {showTechnical && !simple && (
            <section className="bg-gray-900 border border-gray-800 rounded-md p-6 shadow-sm text-gray-300 text-sm animate-enter">
              <h3 className="text-lg font-bold text-white mb-4">{t("photo.howCalculated")}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 font-mono text-xs block mb-1">{t("batch.techModelLabel")}</span>
                  <span className="font-mono text-brand-300">{t("batch.techModelValue")}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-mono text-xs block mb-1">{t("batch.techTargetLabel")}</span>
                  <span className="font-mono text-brand-300">{t("batch.techTargetValue")}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 font-mono text-xs block mb-1">{t("batch.techFeaturesLabel")}</span>
                  <span className="font-mono text-brand-300">{t("batch.techFeaturesValue")}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-mono text-xs block mb-1">{t("batch.techValidationLabel")}</span>
                  <span className="font-mono text-brand-300">{t("batch.techValidationValue")}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-mono text-xs block mb-1">{t("batch.techDataTypeLabel")}</span>
                  <span className="font-mono text-brand-300">{t("batch.techDataTypeValue")}</span>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
