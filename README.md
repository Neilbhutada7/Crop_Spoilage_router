# Smart Spoilage Router 🚀

An AI-powered logistics prototype designed to minimize post-harvest agricultural waste. This platform leverages real-time weather APIs and machine learning to predict crop spoilage risks and dynamically route shipments to the most profitable markets.

## Features
- **Real-Time Weather Integration**: Fetches current temperature and humidity data for farms using the OpenWeather API and the browser Geolocation API.
- **AI Risk Engine**: Powered by an XGBoost model trained on real-world Kaggle datasets, the engine predicts the likelihood of spoilage based on storage conditions and biological crop profiles.
- **7-Day Risk Forecast**: Simulates future risk extrapolation, allowing farmers and distributors to visualize what will happen if they delay routing by up to a week.
- **Dynamic Routing**: Suggests optimal destination markets based on real-time simulated market prices, distance, and transit risk.

## Tech Stack
- **Frontend**: React.js, Vite, Vanilla CSS (Enterprise SaaS aesthetic)
- **Backend**: Python, Flask, Gunicorn
- **Machine Learning**: XGBoost, Pandas, Scikit-learn
- **Database**: SQLite
- **APIs**: OpenWeatherMap Geocoding & Weather APIs

## Local Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
flask run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Model Training
The machine learning model (`model.pkl`) was trained on 3,000 samples of real-world post-harvest wastage data. To retrain the model locally on a new dataset:
1. Place a dataset CSV in the `backend/` directory.
2. Run `python seed_and_train.py`.
3. The server will dynamically hot-reload the new model weights.
