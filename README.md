# AgriRoute AI 🚀

An AI-assisted logistics prototype for reducing post-harvest agricultural
waste. It predicts a batch's spoilage risk from weather and time-since-harvest,
estimates a benchmark remaining shelf life, and ranks candidate markets by an
explicit expected-money-after-costs formula rather than a single opaque
score.

See [`MODEL.md`](MODEL.md) for the ML methodology (target variable, dataset,
ground truth, train/test split, metrics, limitations) and
[`STATUS.md`](STATUS.md) for an honest implemented/partial/future breakdown
of every feature and a response to Round 1 feedback.

## What this actually does today

- **Spoilage risk**: an XGBoost regressor trained on `backend/fresh_produce_wastage_dataset.csv` (3,000 rows, 2,756 after cleaning) predicts expected wastage %, converted to a 0–100 risk score. One-hot crop encoding (not an ordinal integer); `humidity_pct` was tested as a feature and dropped after it proved to have ~zero correlation with the target and to hurt held-out accuracy; monotone constraints force risk to never decrease with age or temperature. Test R² = 0.319, MAE = ±2.92 points on a held-out 20% split; a thresholded classification view gives Accuracy 0.772 / ROC-AUC 0.768 — see `MODEL.md` for the full metrics, the feature-selection experiment, why these numbers (not nicer-looking invented ones) are what's shown, and the estimated-remaining-shelf-life benchmark this model also feeds.
- **Remaining shelf life**: an *estimated/benchmark* figure — the first day offset (0–15 days ahead) at which the risk forecast crosses into the High-risk band. Not a scientifically validated shelf-life measurement.
- **Destination ranking**: `expected_realised_value = revenue − transport_cost − storage_cost − (spoilage_probability × value_at_risk)`, computed per candidate destination, with a "Why this market?" breakdown showing every term. Four route modes (Fastest / Lowest Cost / Lowest Risk / Best Value) sort the same computed data differently rather than being cosmetic buttons.
- **Baseline comparison**: Nearest Market / Highest Price Market / Price-Minus-Distance / AgriRoute AI side by side, so the optimization's value is demonstrable rather than asserted.
- **Sell vs. Store**: scenario analysis (0/1/3/5 day hold) at a constant reference price — explicitly not a price forecast.
- **Batch passport + predicted vs. actual**: every batch gets an `AGR-YYYY-#####` ID; recording an actual sale outcome computes a real prediction-error number instead of leaving it hypothetical.
- **Weather**: live via OpenWeatherMap when `OPENWEATHER_API_KEY` is set; a clearly-flagged synthetic fallback (`is_synthetic: true`) otherwise. The UI shows which one you're looking at.
- **Farmer assistant**: rule-based, not an LLM integration. When given a batch context it answers from that batch's real computed values (price, risk, route) rather than inventing numbers; otherwise it falls back to static crop-fact replies.
- **SMS dispatch**: mock only — logs to the server console and returns `status: "MOCK"`. No Twilio/Exotel integration exists. Labeled Future/Phase 3 everywhere, including the dispatch button.

## Technology Stack (finalized — one technology per layer)

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Axios, Recharts |
| Backend | Python, Flask |
| ML | XGBoost (XGBRegressor), scikit-learn (train/test split + metrics), pandas |
| Database | SQLite (`backend/spoilage_router.db`) |
| Maps | Leaflet + OpenStreetMap tiles |
| Market data | Synthetic demo data (`backend/seed_db.py`) — no live mandi price feed is connected |
| Weather | OpenWeatherMap (falls back to a labeled synthetic reading if no API key) |
| Farmer assistant | Rule-based Flask endpoint grounded in real batch data — not GPT/an LLM |
| Messaging | Mock (console log) — no SMS/IVR provider integrated |

An earlier version of `docker-compose.yml` also provisioned a Postgres/PostGIS
service that the backend never actually queried (it only ever used SQLite
directly). That dead config has been removed so the stack described here
matches what's deployed.

## Local Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python seed_db.py        # first run only — seeds destinations/price history
python seed_and_train.py # trains model.pkl + writes model_metrics.json
python app.py             # serves on :5000 by default (override with PORT env var)
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Single-URL mode (optional)

For sharing a demo as one link instead of two dev-server ports: build the
frontend, then start only the backend — Flask detects `frontend/dist/` and
serves the built app itself, with the API on the same origin.

```bash
cd frontend
VITE_API_URL=http://localhost:5000 npm run build   # match whatever PORT the backend will use
cd ../backend
python app.py
```

Then everything — UI and API — is reachable at `http://localhost:5000`
(or whichever `PORT` you set). This is additive: running `npm run dev`
separately still works exactly as before if `frontend/dist/` doesn't exist
or you'd rather iterate on the frontend with hot reload.

## Model Training

See [`MODEL.md`](MODEL.md) for full methodology. To retrain:
```bash
cd backend
python seed_and_train.py
```
This regenerates both `model.pkl` and `model_metrics.json` from a fresh
80/20 split — metrics shown in the UI always come from this file, never from
hardcoded numbers.
