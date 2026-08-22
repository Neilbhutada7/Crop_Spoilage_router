# Round 2.2 Remaining Work Plan

Scoped to be realistic, not aspirational. Each task lists what's actually
missing (from `STATUS.md`), a rough estimate, its dependency, the main risk,
and how we'd mitigate it.

| Task | Owner | Est. time | Dependency | Risk | Mitigation |
|---|---|---|---|---|---|
| Crop image quality analyzer (blur/brightness/grade) | ML/backend | 3–4 days | None — can be built with pure image heuristics (Laplacian variance for blur, mean pixel value for brightness), no external API required | Grade accuracy without a labeled defect dataset | Ship blur/brightness/quality-tier checks first (objectively measurable); defer AI defect detection until a labeled dataset exists; always label output "AI Visual Quality Assessment," never "Official Quality Certificate" |
| Real GPT integration for the farmer assistant | Backend | 1 day (if an API key is available) | An LLM API key | Model could invent numbers if not constrained | Keep the current architecture — LLM only formats/explains values already computed by the backend (batch/risk/route), never generates price/risk/route numbers itself |
| Real SMS integration (Twilio/Exotel) | Backend | 1 day | Provider account + credentials | None significant once credentials exist | Swap the mock `send_sms()` body for the provider SDK call; keep the same response shape so the frontend doesn't need changes |
| Marathi UI + finish Hindi coverage (Settings/Analytics/Active Routes) | Frontend | 2 days | None | Translation quality for domain terms | Reuse the existing `isHindi` ternary pattern; get a native-speaker review pass on the terminology (e.g., "Expected Money After Costs") before the final demo |
| Real market price feed (e.g. Agmarknet) | Backend | 3–5 days | API access/scraping approval for a real mandi price source | Feed reliability/rate limits | Cache fetched prices with a timestamp; fall back to the existing SYNTHETIC data with the label intact if the feed is down, rather than blocking the app |
| Pilot data collection loop | Full team | Ongoing, starts immediately | Willing pilot farmers/partners | Low initial volume — metrics will show "insufficient data" for a while | This is expected and correct behavior, not a bug; the Batch Passport + actual-outcome recording already exists to support this — the gap is real-world usage, not code |
| Retrain model on pilot + monotonic/feature review | ML | 1–2 days once ≥100+ real outcomes exist | Pilot data above | Small-sample overfitting | Keep the same held-out-metrics discipline (`seed_and_train.py` pattern); don't report metrics until there's a real test set of meaningful size |
| Real routing/travel-time engine (OSRM/Mapbox Directions) | Backend | 2–3 days | API key or self-hosted OSRM | Cost/rate limits at scale | Keep the current straight-line/40kmh estimate as an explicit fallback, clearly labeled, if the real routing call fails |
| Offline / low-connectivity mode | Frontend | 3 days | None | Sync-conflict edge cases | Start read-only (cache last-fetched batch/risk data locally); defer offline batch creation + sync until the read-only path is solid |
| Lot segmentation (mixed-grade batches) | Backend/Frontend | 2–3 days | Depends on the crop image analyzer producing a real grade | None new beyond the analyzer's own risk | Don't build until the underlying grading model exists — building the UI first would mean fabricating grade data, which we're explicitly avoiding |

## Sequencing recommendation

1. Real SMS + pilot data collection can start immediately (no blockers).
2. Crop image analyzer and market price feed can run in parallel once
   resourced.
3. GPT integration only if a key is actually available — otherwise the
   current grounded rule-based assistant already satisfies "doesn't invent
   numbers," which is the actual requirement, not "uses an LLM."
4. Retraining, lot segmentation, and offline mode are downstream of the
   above and shouldn't be started before their dependencies land.
