# AgriRoute AI — Status, Feedback Response & Readiness

This document is the single honest source of truth for what's implemented,
what's partial, and what's future scope. Nothing in this file should ever
say IMPLEMENTED for something the code doesn't actually do — if a feature
audit here goes stale, trust the code over this document and file a
correction.

## 0. UI architecture (rebuilt)

The frontend was rebuilt from a single scrolling dashboard into a proper
multi-page app: React Router with dedicated pages (Dashboard, AI Assistant,
Check My Crop, Check Your Crop, Best Market, View Route, Settings), a shared
`AppContext` for cross-page batch state, green "AgriRoute AI" branding, and
a docked sidebar/topbar layout. All existing backend logic and data
honesty work carried over unchanged — this was a presentation-layer
reorganization, not a re-implementation. Two components (`ActiveRoutes.jsx`,
`Analytics.jsx`, the old floating `CropAssistant.jsx` widget) are no longer
routed but remain in the repo; their real-data functionality (batch listing,
session analytics) is now covered by the Dashboard's batch table and could
be revived as a dedicated Reports page if needed.

## 1. Feature Audit

| Feature | Status | Data Source | Notes |
|---|---|---|---|
| Spoilage risk prediction (XGBoost) | **IMPLEMENTED** | Benchmark dataset (`fresh_produce_wastage_dataset.csv`) | One-hot crop encoding; `humidity_pct` tested and dropped (r=-0.01 with target, hurt held-out R²); monotone constraints on both days-since-harvest and temperature. Test R²=0.319, MAE=±2.92 pts; classification view (≥50 Risk Index) Accuracy=0.772, ROC-AUC=0.768. See `MODEL.md`. |
| Remaining shelf life | **IMPLEMENTED** | Derived from risk model | Labeled Estimated/Benchmark, not scientifically validated. |
| Weather integration | **IMPLEMENTED** | OpenWeatherMap (live) or synthetic fallback | UI shows which one is active. |
| Destination ranking (expected value) | **IMPLEMENTED** | Synthetic price/destination data + real formula | Formula is real and transparent; underlying prices are demo data. |
| Route modes (Fastest/Cost/Risk/Value) | **IMPLEMENTED** | Computed from the same data | Real sort keys, not cosmetic. |
| Baseline comparison | **IMPLEMENTED** | Same demo data | Nearest/Highest-Price/Price-Minus-Distance/AgriRoute AI, side by side. |
| Sell vs. Store | **IMPLEMENTED** | Scenario analysis | No price forecasting — explicitly stated. |
| Batch passport | **IMPLEMENTED** | Real DB records | `AGR-YYYY-#####` ID, connects batch → risk → route → actual outcome. |
| Predicted vs. actual tracking | **IMPLEMENTED** | Real DB records | Requires a human to record an actual outcome; starts empty each fresh deployment. |
| "Can My Crop Reach the Market?" decision card | **IMPLEMENTED** | Derived from risk + route data | 🟢🟠🔴 status with recommendations. |
| Market price data | **SYNTHETIC** | `backend/seed_db.py` random walk | Explicitly labeled SYNTHETIC/BENCHMARK everywhere it's shown; never called "live." |
| Storage capacity data | **SYNTHETIC** | `backend/seed_db.py` | `is_synthetic` flag stored in DB and surfaced via `/api/destinations`. |
| Photo quality check (blur/brightness/resolution) | **IMPLEMENTED** | Objective image analysis (Laplacian variance, mean brightness, resolution) — not a trained model | `POST /api/crop-image/quality-check`. Correctly rejects blurry/dark/low-res photos with retake instructions. |
| Visible-damage risk adjustment | **IMPLEMENTED** | Farmer self-reported (None/Minor/Moderate/Severe), applied as a documented benchmark multiplier on model input | Not AI-detected, not a trained feature — see `MODEL.md`. Verified: 'severe' raises risk score and lowers shelf-life estimate vs. 'none' for an identical batch. |
| AI Visual Quality Assessment (crop quality/freshness grade) | **MISSING** | — | Not built. No labeled freshness/defect dataset exists in this repo to honestly back a grade — see below. |
| GPT / LLM farmer assistant | **PARTIALLY IMPLEMENTED** | Rule-based, not an LLM | When given a batch context, answers are grounded in that batch's real computed values (see `answer_from_batch_context` in `app.py`) — it does not invent numbers, but it is not a GPT/LLM integration. |
| SMS dispatch | **MOCK ONLY — Phase 3 / Future** | — | Logs to console, returns `status: "MOCK"`. UI button and toast say this explicitly. No Twilio/Exotel integration. |
| IVR | **NOT AVAILABLE / Future scope** | — | Never implemented; not referenced anywhere as working. |
| Hindi UI | **IMPLEMENTED** (with one known gap) | — | All pages translated: Dashboard, batch form, risk card, destination list, baseline comparison, sell-vs-store, batch passport, photo quality check, Settings, Analytics, Active Routes. Known gap: crop names (`tomato`, `banana`, ...) and the crop-type dropdown options are raw English DB/API values, not translated — fixing this needs a small crop-name lookup table, not yet built. |
| Marathi UI | **MISSING** | — | Not implemented. Doing it properly means extending every existing Hindi ternary to a 3-way check across ~10 files; scoped as a dedicated Round 2.2 task (see `ROADMAP.md`) rather than rushed here. |
| Offline / low-internet mode | **MISSING** | — | Not implemented; not claimed anywhere in the UI. |
| Lot segmentation (mixed-grade batches) | **MISSING** | — | Requires a quality-grading model, which doesn't exist yet (see crop image analyzer above). |
| Post-harvest loss calculator | **PARTIALLY IMPLEMENTED** | Derived | Expected spoilage loss is shown per destination; a dedicated harvest-quantity/expected-vs-actual-loss summary view is not yet a standalone screen (the data exists via Batch Passport + Analytics). |
| Maps | **IMPLEMENTED, REAL** | Leaflet + OpenStreetMap tiles | Working. |

### 1a. Why there's no crop quality *grade* (only a photo *quality check*)

The repo contains a `banana_dataset/` (labeled by banana **variety** — honeybanana,
nendranbanana, etc. — not by freshness or defect) and an unused Sri Lankan
onion CSV. Neither supports a defensible "quality grade" model, so we didn't
build one — doing so would mean fabricating a grade the same way the old
hardcoded R²=0.978 fabricated a metric. What *is* built and real: an
objective photo-usability check (blur via Laplacian variance, brightness via
mean pixel value, resolution) that classifies a photo as GOOD/FAIR/POOR and
gives retake instructions on POOR — this is the "image quality check" part
of the brief, honestly delivered without the "AI visual quality assessment"
part that would require data we don't have.

### 1b. Comparable project audit (`C:\Crop`)

A separate, more feature-complete "friend's project" was located locally
(`C:\Crop`) and audited before any integration decision, per instruction.
Findings:

- **Claimed "~100,000 records" is not accurate.** Actual: 6,000 rows
  (5,000 train + 1,000 test), per `backend/model_artifacts/model_meta.json`.
- **100% synthetic** — generated by a hand-written Q10-style decay formula
  plus Gaussian noise (`backend/ml/generate_training_data.py`), not sampled
  or collected from any real source. The project's own `MODEL.md` says so
  explicitly and honestly.
- Reported metrics (R²=0.974–0.978, MAE≈3.55–4.25) reflect the model
  recovering its own generating formula, not generalization to real-world
  variance — a materially weaker validation claim than it looks, despite
  the higher number. This is, in fact, the exact source of the fabricated
  R²=0.978 that was hardcoded into this project's UI and removed earlier
  in this review — someone had copied that project's number into this one.
- **Decision** (confirmed with the user): kept this project's own model as
  the base — real external dataset, 10 crops vs. 6, honest held-out
  validation on non-self-generated data — and adopted two *ideas* from the
  comparable project honestly rather than transplanting its model wholesale:
  a visible-damage input adjustment (farmer-reported, not a fabricated
  trained feature — see `MODEL.md`) and confirmed our existing
  transit-time-folded-into-age approach was already the right call for a
  dataset that has no transit column of its own.
- Genuinely useful, non-ML components identified but not yet pulled in:
  a working Marathi+Hindi locale file system (`frontend/src/locales/`) and
  a GPT-assistant-with-rule-based-fallback service pattern — both flagged
  as future work, not integrated in this pass.

## 2. Data Source Classification

| Source | Classification | Where labeled |
|---|---|---|
| XGBoost model training data | Benchmark (provenance as real-world data unverified) | `MODEL.md`, `/api/model/info` |
| Weather (with API key set) | LIVE | `weather_is_synthetic: false` in API responses |
| Weather (no API key) | SYNTHETIC | `weather_is_synthetic: true`, shown in UI |
| Market/mandi prices | SYNTHETIC | `price_status: "SYNTHETIC"` on every destination |
| Storage facility "price" | BENCHMARK (avg. mandi price, not the facility's own price) | `price_status: "BENCHMARK"` |
| Destinations (locations, capacity) | SYNTHETIC | `is_synthetic: true` in `destinations` table and API |
| Batches, risk assessments, route selections, actual outcomes | REAL | Live SQLite rows created by real usage of the app |

## 3. Round 1 Feedback → Action Taken

| Feedback | Action Taken | Evidence |
|---|---|---|
| "Core ML methodology is insufficiently justified." | Defined exact target variable, dataset, ground-truth classification, 80/20 held-out split, leakage check, monotonicity constraint, and real computed metrics (replacing a previously hardcoded, never-computed R²=0.978). | `MODEL.md`, `backend/seed_and_train.py`, `backend/model_metrics.json`, `/api/model/info` |
| "Destination ranking is relatively simplistic." | Replaced a same-units-mismatched heuristic (₹/km subtracted from ₹/kg) with an explicit `revenue − transport − storage − (spoilage probability × value at risk)` formula, shown per-destination as "Why this market?" | `build_destination_options()` in `backend/app.py`, `DestinationList.jsx` |
| "Synthetic storage-capacity data." | All storage/market data explicitly labeled SYNTHETIC or BENCHMARK in both API responses and UI; nothing is called "live" or "guaranteed." | `/api/destinations`, `DestinationList.jsx` |
| "Technology stack not finalized." | One technology per layer, documented in `README.md`. Removed a dead, unused Postgres/PostGIS service from `docker-compose.yml` that the backend never actually queried (it only ever used SQLite). | `README.md` → Technology Stack, `docker-compose.yml` |
| "SMS/IVR inconsistency (implemented on one slide, Phase 3 on another)." | SMS is now labeled MOCK/Phase 3 consistently everywhere it appears — the dispatch button, the toast message, and the backend response all say the same thing. IVR is labeled Future scope; it was never implemented. | `app.py` → `send_sms()`, `DestinationList.jsx`, `App.jsx` |
| "Crop-specific decay features requested." | Documented and used a per-crop `decay_constant` feature (10 crops) in the model; documented in `MODEL.md` with exact values. | `MODEL.md`, `DECAY_CONSTANTS` in `app.py` |
| "No baseline comparison." | Added Nearest Market / Highest Price / Price-Minus-Distance / AgriRoute AI comparison table, computed from the same underlying data. | `/api/batches/<id>/baseline-comparison`, `BaselineComparison.jsx` |

## 4. Known Limitations (do not paper over these in a demo)

- Model test R² is 0.319 — a real but modest signal, not a polished production model. See `MODEL.md` for why.
- Training dataset provenance (real-world vs. synthetic benchmark) has not been independently verified.
- No real pilot/farmer outcome data has been incorporated into training yet — the app now supports recording it (Batch Passport), but the loop hasn't closed with real data yet.
- All market prices, storage capacities, and destination data are synthetic/demo — there is no live mandi price feed or storage-capacity API connected.
- Travel time is a straight-line-distance ÷ assumed 40 km/h estimate, not a real routing/traffic engine (no Mapbox/OSRM/Google Directions integration).
- SMS/IVR/GPT/crop-image-analysis are not real integrations (see feature audit above).
- Predicted-vs-actual and the model-validation MAE/R² only become statistically meaningful once enough real outcomes are recorded — with 0–1 recorded outcomes, the app correctly says "insufficient data" rather than showing a misleadingly precise number.

## 5. Final SIH Round 2 Readiness Summary

**1. Working Prototype** — Status: Functional end-to-end for the core workflow (create batch → risk → shelf life → destinations/route modes → baseline comparison → sell-vs-store → dispatch → batch passport → record actual outcome → predicted-vs-actual). Verified via automated browser testing (Playwright) with zero console/page errors. Evidence: this repo, `python backend/app.py` + `npm run dev`.

**2. Technical Architecture** — Status: One technology per layer, documented, and the stack described matches what's deployed (dead Postgres config removed). Evidence: `README.md` → Technology Stack.

**3. Roadmap Progress** — Status: Core spoilage → destination → route → outcome loop is implemented; crop image analysis, GPT integration, real SMS/IVR, and full multilingual coverage remain future scope (see Section 1). Evidence: this file's feature audit.

**4. Remaining Work** — Status: See `ROADMAP.md` for a scoped, realistic Round 2.2 plan.

**5. Round 1 Feedback** — Status: All six specific committee points addressed with code-level evidence (Section 3).

**6. Q&A Readiness** — Status: See `QA_PREP.md` for prepared, implementation-grounded answers to 25 likely questions.
