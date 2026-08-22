import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api";

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1.5">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function fmtRs(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

// Real, recorded outcomes only -- this is the judge-facing validation page,
// so it pulls whichever batches actually have a farmer-recorded actual sale
// (see batch_history_service.py::mark_batch_sold) rather than any synthetic
// stand-in. Capped at a handful so this doesn't turn into an unbounded fetch
// loop against every sold batch that's ever existed.
const MAX_REPRESENTATIVE_BATCHES = 5;

export default function ModelPerformance() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [representativeBatches, setRepresentativeBatches] = useState(null);

  useEffect(() => {
    api.getModelInfo().then(setInfo).catch(() => setError(t("common.genericError")));
  }, []);

  useEffect(() => {
    api.getBatches().then((batches) => {
      const sold = batches.filter((b) => b.status === "sold").slice(0, MAX_REPRESENTATIVE_BATCHES);
      Promise.all(sold.map((b) => api.getPredictedVsActual(b.id).then((pva) => ({ ...b, ...pva })).catch(() => null)))
        .then((rows) => setRepresentativeBatches(rows.filter((r) => r?.has_actual_outcome)));
    }).catch(() => setRepresentativeBatches([]));
  }, []);

  if (error) return <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>;
  if (!info) return <div className="text-sm text-gray-400">{t("common.loading")}</div>;

  const cls = info.classification_view;
  const maxImportance = Math.max(...info.feature_importances.map((f) => f.importance));
  const importanceData = info.feature_importances.map((f) => ({ name: f.label, value: Math.round(f.importance * 1000) / 10 }));
  const matrix = cls?.confusion_matrix?.matrix;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("model.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("model.subtitle")}</p>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-md p-5">
        <h2 className="text-sm font-bold text-brand-800 mb-1">{t("model.aiModelExplain")}</h2>
        <p className="text-xs text-brand-900/80 leading-relaxed">{t("model.aiModelExplainBody")} (<strong>{info.algorithm}</strong>, v{info.model_version})</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><div className="text-gray-400 text-xs">{t("model.datasetSize")}</div><div className="font-bold text-gray-900">{info.training.n_training_rows.toLocaleString("en-IN")}</div></div>
        <div><div className="text-gray-400 text-xs">{t("model.testSetSize")}</div><div className="font-bold text-gray-900">{info.training.n_test_rows?.toLocaleString("en-IN") ?? "—"}</div></div>
        <div><div className="text-gray-400 text-xs">{t("model.featuresCount")}</div><div className="font-bold text-gray-900">{info.feature_columns.length}</div></div>
        <div><div className="text-gray-400 text-xs">{t("model.validation")}</div><div className="font-bold text-gray-900">{info.training.validation_method}</div></div>
      </div>

      {cls ? (
        <>
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-1">{t("model.title")}</h2>
            <p className="text-xs text-gray-400 mb-3">{t("model.classificationExplain", { threshold: cls.threshold })}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard label={t("model.accuracy")} value={`${(cls.accuracy * 100).toFixed(1)}%`} />
              <MetricCard label={t("model.precision")} value={`${(cls.precision * 100).toFixed(1)}%`} />
              <MetricCard label={t("model.recall")} value={`${(cls.recall * 100).toFixed(1)}%`} />
              <MetricCard label={t("model.f1")} value={`${(cls.f1 * 100).toFixed(1)}%`} />
              <MetricCard label={t("model.rocAuc")} value={cls.roc_auc !== null ? `${(cls.roc_auc * 100).toFixed(1)}%` : "—"} />
            </div>
          </div>

          {matrix && (
            <div className="bg-white border border-gray-200 rounded-md p-6">
              <h2 className="text-sm font-bold text-gray-800 mb-1">{t("model.confusionMatrix")}</h2>
              <p className="text-xs text-gray-400 mb-4">{t("model.confusionMatrixNote")}</p>
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 max-w-md">
                <div />
                <div className="text-center text-xs font-semibold text-gray-500">{t("model.predAcceptable")}</div>
                <div className="text-center text-xs font-semibold text-gray-500">{t("model.predSpoiled")}</div>
                <div className="flex items-center text-xs font-semibold text-gray-500">{t("model.actualAcceptable")}</div>
                <div className="bg-brand-50 border border-brand-100 rounded-lg py-4 text-center font-bold text-brand-800 text-lg">{matrix[0][0]}</div>
                <div className="bg-red-50 border border-red-100 rounded-lg py-4 text-center font-bold text-red-700 text-lg">{matrix[0][1]}</div>
                <div className="flex items-center text-xs font-semibold text-gray-500">{t("model.actualSpoiled")}</div>
                <div className="bg-red-50 border border-red-100 rounded-lg py-4 text-center font-bold text-red-700 text-lg">{matrix[1][0]}</div>
                <div className="bg-brand-50 border border-brand-100 rounded-lg py-4 text-center font-bold text-brand-800 text-lg">{matrix[1][1]}</div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400">{t("model.notAvailable")}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-1">{t("model.featureImportance")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("model.featureImportanceNote")}</p>
        <ResponsiveContainer width="100%" height={Math.max(180, importanceData.length * 34)}>
          <BarChart data={importanceData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" horizontal={false} />
            <XAxis type="number" domain={[0, Math.ceil(maxImportance * 100)]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} unit="%" />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${v}%`, t("model.featureImportance")]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Bar dataKey="value" fill="#1f6f4a" radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 leading-relaxed">{info.caveat}</p>
      {info.blend_note && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 leading-relaxed">{info.blend_note}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-1">{t("model.representativeBatchesTitle")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("model.representativeBatchesNote")}</p>
        {representativeBatches === null && <p className="text-xs text-gray-400">{t("common.loading")}</p>}
        {representativeBatches?.length === 0 && <p className="text-xs text-gray-400">{t("model.representativeBatchesEmpty")}</p>}
        {representativeBatches?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-semibold">{t("dashboard.cropCol")}</th>
                  <th className="pb-2 font-semibold text-right">{t("model.predictedNetValueCol")}</th>
                  <th className="pb-2 font-semibold text-right">{t("model.actualNetValueCol")}</th>
                  <th className="pb-2 font-semibold text-right">{t("model.differenceCol")}</th>
                </tr>
              </thead>
              <tbody>
                {representativeBatches.map((b) => {
                  const diff = b.predicted_net_value != null && b.actual_net_value != null ? b.actual_net_value - b.predicted_net_value : null;
                  return (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 font-semibold text-gray-800 capitalize">#{b.id} {t(`crops.${b.crop_type}`, b.crop_type)}</td>
                      <td className="py-2.5 text-right text-gray-600 tabular-nums">{b.predicted_net_value != null ? fmtRs(b.predicted_net_value) : "—"}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-800 tabular-nums">{b.actual_net_value != null ? fmtRs(b.actual_net_value) : "—"}</td>
                      <td className={`py-2.5 text-right font-semibold tabular-nums ${diff == null ? "text-gray-400" : diff >= 0 ? "text-brand-700" : "text-red-600"}`}>
                        {diff != null ? `${diff >= 0 ? "+" : ""}${fmtRs(diff)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {info.limitations?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3">{t("model.limitationsTitle")}</h2>
          <ul className="space-y-2">
            {info.limitations.map((l, i) => (
              <li key={i} className="text-xs text-gray-500 leading-relaxed flex gap-2">
                <span className="text-gray-300 shrink-0">&bull;</span> {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
