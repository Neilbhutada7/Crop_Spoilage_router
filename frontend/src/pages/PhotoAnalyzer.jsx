import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppData } from "../AppDataContext";
import { riskColor } from "../colors";
import { IconThermometer, IconRoute, IconTag, IconSparkle, IconCheck, IconAlertTriangle } from "../components/Icons";

const CROPS = ["tomato", "onion", "banana", "potato", "mango"];
const RETAKE_TIP_KEYS = ["use_daylight", "keep_crop_close", "hold_steady", "show_multiple_pieces", "avoid_shadows", "keep_centered"];

function fmtRs(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }
function gradeColor(grade) { return riskColor(grade === "A" ? "Low" : grade === "B" ? "Medium" : "High"); }

function Section({ title, children, right }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function HowCalculated({ text }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 pt-3 border-t border-gray-50">
      <button onClick={() => setOpen((v) => !v)} className="text-[11px] font-semibold text-brand-700 hover:underline">
        {t("photo.howCalculated")}
      </button>
      {open && <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{text}</p>}
    </div>
  );
}

export default function PhotoAnalyzer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { batch: sessionBatch, cropType: batchCropType } = useAppData();

  // AppDataContext.batch only holds a batch created earlier in THIS
  // session's in-memory state -- reaching this page via the sidebar (rather
  // than clicking through from "Check My Crop" moments earlier) leaves it
  // null even though the farmer has a real current batch on the server.
  // Falls back to the same "most recent batch" lookup the Dashboard uses,
  // so Photo Check reliably links to the farmer's actual current harvest.
  const [fallbackBatch, setFallbackBatch] = useState(null);
  useEffect(() => {
    if (sessionBatch) return;
    api.getBatches().then((rows) => { if (rows?.length) setFallbackBatch(rows[0]); }).catch(() => {});
  }, [sessionBatch]);
  const batch = sessionBatch || fallbackBatch;

  const [cropType, setCropType] = useState(batchCropType || batch?.crop_type || "tomato");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  // Once the fallback batch resolves, default the crop-type selector to
  // match it (only if the farmer hasn't already picked one) -- otherwise
  // photo analysis would silently run against the wrong crop entirely.
  useEffect(() => {
    if (fallbackBatch && !sessionBatch) setCropType(fallbackBatch.crop_type);
  }, [fallbackBatch, sessionBatch]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.analyzePhoto(file, cropType, { batchId: batch?.id });
      setResult(res);
    } catch {
      setError(t("photo.analysisError"));
    } finally {
      setAnalyzing(false);
    }
  }

  function handleRetake() {
    setFile(null);
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  const qualityMessageKey = result?.quality ? `photo.quality.${result.quality.overall.toLowerCase()}` : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("photo.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("photo.subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4 items-start">
        {/* LEFT: capture panel */}
        <div className="bg-white border border-gray-200 rounded-md p-5 space-y-4">
          <label className="block text-xs font-semibold text-gray-600">
            {t("photo.cropTypeLabel")}
            <select value={cropType} onChange={(e) => setCropType(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
              {CROPS.map((c) => <option key={c} value={c}>{t(`crops.${c}`)}</option>)}
            </select>
          </label>

          {previewUrl ? (
            <div className="space-y-2">
              <img src={previewUrl} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
              <button onClick={handleRetake} className="w-full py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50">
                {t("photo.changePhoto")}
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <p className="text-xs text-gray-400 mb-3">{t("photo.uploadPrompt")}</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => cameraInputRef.current?.click()} className="py-2.5 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800">
                  {t("photo.takePhoto")}
                </button>
                <button onClick={() => uploadInputRef.current?.click()} className="py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
                  {t("photo.uploadPhoto")}
                </button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <input ref={uploadInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
          )}

          {file && (
            <button onClick={handleAnalyze} disabled={analyzing} className="w-full py-2.5 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800 disabled:opacity-50">
              {analyzing ? t("photo.analyzing") : t("photo.analyzeButton")}
            </button>
          )}
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          {!batch && <p className="text-[11px] text-gray-400 leading-relaxed">{t("photo.noBatchNote")}</p>}

          <p className="text-[11px] text-gray-400 leading-relaxed pt-2 border-t border-gray-50">{t("photo.limitations")}</p>
        </div>

        {/* RIGHT: results */}
        <div className="space-y-4">
          {!result && !analyzing && (
            <div className="bg-white border border-gray-200 rounded-md p-12 text-center text-sm text-gray-400">
              {t("photo.uploadPrompt")}
            </div>
          )}

          {result?.status === "retake_requested" && (
            <Section title={t("photo.retake.title")}>
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs font-semibold mb-4">
                <IconAlertTriangle width={14} height={14} /> {t(qualityMessageKey)}
              </div>
              <ul className="space-y-1.5 mb-4">
                {RETAKE_TIP_KEYS.map((k) => (
                  <li key={k} className="flex items-start gap-1.5 text-sm text-gray-700">
                    <IconCheck width={14} height={14} className="text-brand-600 mt-0.5 shrink-0" />
                    {t(`photo.retake.tips.${k}`)}
                  </li>
                ))}
              </ul>
              <button onClick={handleRetake} className="px-5 py-2.5 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800">
                {t("photo.retake.button")}
              </button>
            </Section>
          )}

          {result?.status === "ok" && (
            <>
              {/* Quality + reliability */}
              <Section title={t("photo.quality.title")}>
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold mb-3 ${
                  result.quality.overall === "GOOD" ? "text-brand-700 bg-brand-50 border border-brand-100" : "text-amber-700 bg-amber-50 border border-amber-100"
                }`}>
                  {t(qualityMessageKey)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{t("photo.reliability")}</span>
                  <span className="font-bold" style={{ color: result.reliability === "High" ? riskColor("Low") : riskColor("Medium") }}>
                    {t(`photo.reliability${result.reliability}`)}
                  </span>
                </div>
                {result.reliability !== "High" && <p className="text-[11px] text-gray-400 mt-1">{t("photo.reliabilityNoteMedium")}</p>}
                <HowCalculated text={result.quality.methodology} />
              </Section>

              {/* Enhancement */}
              {result.enhanced_image && (
                <Section title={t("photo.enhancement.title")}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <img src={result.original_image} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                      <p className="text-[10px] text-gray-400 text-center mt-1 font-semibold uppercase">{t("photo.enhancement.original")}</p>
                    </div>
                    <div>
                      <img src={result.enhanced_image} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                      <p className="text-[10px] text-gray-400 text-center mt-1 font-semibold uppercase">{t("photo.enhancement.enhanced")}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3">{t("photo.enhancement.note")}</p>
                </Section>
              )}

              {/* Visual grade */}
              <Section title={t("photo.visualQuality")}>
                <div className="flex items-center gap-5">
                  <div className="text-4xl font-bold text-gray-900">{result.visual_grade.score}<span className="text-lg text-gray-400">/100</span></div>
                  <div className="px-3 py-1.5 rounded-lg text-white font-bold text-lg" style={{ background: gradeColor(result.visual_grade.grade) }}>
                    {result.visual_grade.grade}
                  </div>
                  <div className="text-[11px] text-gray-400 leading-snug">{t("photo.grade")}<br />{t("photo.gradeNote")}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">{t("photo.colourUniformity")}</span><span className="font-semibold text-gray-800">{result.visual_grade.colour_uniformity.label}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">{t("photo.darkArea")}</span><span className="font-semibold text-gray-800">{result.visual_grade.dark_discoloured_area.label}</span></div>
                </div>
                <HowCalculated text={result.visual_grade.methodology} />
              </Section>

              {/* Price */}
              {result.market_reference && result.price_range && (
                <Section title={t("photo.marketReference")} right={
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {t(`photo.dataStatus.${result.market_reference.status.toLowerCase()}`)}
                  </span>
                }>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{fmtRs(result.market_reference.price_per_kg)}/{t("common.kg")}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {result.market_reference.days_old === 0 ? t("photo.updatedToday") : t("photo.updatedDaysAgo", { days: result.market_reference.days_old })}
                        {result.market_reference.days_old > 3 && <span className="text-amber-600 font-semibold"> &middot; {t("photo.olderPriceWarning")}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{t("photo.askingPriceRange")}</div>
                      <div className="text-xl font-bold text-brand-700">{fmtRs(result.price_range.suggested_low)}–{fmtRs(result.price_range.suggested_high)}</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-700 mb-2">{t("photo.whyThisPrice")}</div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-gray-400">{t("photo.priceBreakdown.marketReference")}</span><span className="font-semibold text-gray-800">{fmtRs(result.price_range.reference_price_per_kg)}/{t("common.kg")}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">{t("photo.priceBreakdown.estimatedGrade")}</span><span className="font-semibold text-gray-800">{result.price_range.grade}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">{t("photo.priceBreakdown.gradeAdjustment")}</span><span className="font-semibold text-gray-800">{result.price_range.grade_adjustment_pct >= 0 ? "+" : ""}{result.price_range.grade_adjustment_pct}%</span></div>
                      <div className="flex justify-between font-bold"><span className="text-gray-700">{t("photo.priceBreakdown.suggestedRange")}</span><span className="text-brand-700">{fmtRs(result.price_range.suggested_low)}–{fmtRs(result.price_range.suggested_high)}</span></div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">{t("photo.priceDisclaimer")}</p>
                  </div>
                  <HowCalculated text={result.price_range.methodology} />
                </Section>
              )}

              {/* Spoilage + remaining good time + recommendation */}
              {result.spoilage_risk && !result.spoilage_risk.error && (
                <Section title={t("assistant.batchContext.currentRisk")}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-3xl font-bold" style={{ color: riskColor(result.spoilage_risk.risk_label) }}>{Math.round(result.spoilage_risk.risk_score)}%</span>
                    <IconThermometer width={16} height={16} className="text-gray-300" />
                  </div>

                  {result.spoilage_risk.estimated_remaining_shelf_life_days != null && (() => {
                    const photoGoodForDays = Math.max(0, Math.round(result.spoilage_risk.estimated_remaining_shelf_life_days));
                    return (
                    <div className="bg-surface-light border border-gray-100 rounded-md p-3 mb-3">
                      {result.spoilage_risk.shelf_life_estimate_capped && result.spoilage_risk.risk_label !== "Low" ? (
                        <>
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{t("dashboard.riskStaysElevatedTitle")}</div>
                          <div className="text-lg font-bold text-gray-900">{t("dashboard.riskStaysElevated", { score: Math.round(result.spoilage_risk.risk_score) })}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{t("dashboard.remainingTimeTitle")}</div>
                          <div className="text-lg font-bold text-gray-900">
                            {t(result.spoilage_risk.shelf_life_estimate_capped ? "dashboard.moreThanDays" : "dashboard.aboutDays", { days: photoGoodForDays, count: photoGoodForDays })}
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })()}

                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{t("photo.recommendedAction")}</div>
                    <div className="text-base font-bold" style={{ color: riskColor(result.spoilage_risk.risk_label) }}>
                      {result.spoilage_risk.risk_label === "High" ? t("batch.actionSellSoon")
                        : result.spoilage_risk.risk_label === "Medium" ? t("batch.actionConsiderOptions")
                        : t("batch.actionSafeToStore")}
                    </div>
                  </div>

                  <HowCalculated text={t("photo.howCalculatedDestination")} />
                </Section>
              )}

              {result.markets?.[0] && (
                <div className="bg-brand-50 border border-brand-100 rounded-md p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-brand-700">{t("assistant.batchContext.recommendedMarket")}</div>
                    <div className="text-lg font-bold text-gray-900">{result.markets[0].name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500">{t("assistant.batchContext.expectedValue")}</div>
                    <div className="text-xl font-bold text-brand-700">{fmtRs(result.markets[0].expected_realised_value)}</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => navigate("/destination-optimizer")} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50">
                  <IconTag width={13} height={13} /> {t("photo.actions.compareMarkets")}
                </button>
                <button onClick={() => navigate("/route-planner")} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50">
                  <IconRoute width={13} height={13} /> {t("photo.actions.viewRoute")}
                </button>
                <button onClick={() => navigate("/assistant")} className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 text-white text-xs font-semibold rounded-lg hover:bg-brand-800">
                  <IconSparkle width={13} height={13} /> {t("photo.actions.askAI")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
