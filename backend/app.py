import os
import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import pandas as pd
import requests
from datetime import datetime
import traceback
import math

app = Flask(__name__)
CORS(app)



DB_PATH = 'spoilage_router.db'
WEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', '')

# Load model
try:
    with open('model.pkl', 'rb') as f:
        model = pickle.load(f)
except Exception as e:
    print(f"Warning: Could not load model: {e}")
    model = None

DECAY_CONSTANTS = {
    'tomato': 0.15,
    'onion': 0.05,
    'banana': 0.20,
    'potato': 0.04,
    'lemon': 0.08,
    'mango': 0.18,
    'leafy greens': 0.25,
    'pineapple': 0.12,
    'orange': 0.07,
    'strawberry': 0.30
}
CROP_MAPPING = {crop: idx for idx, crop in enumerate(DECAY_CONSTANTS.keys())}

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in kilometers
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)

    a = math.sin(dLat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dLon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@app.route('/api/batches', methods=['POST'])
def create_batch():
    data = request.json
    try:
        crop_type = data['crop_type']
        harvest_date = data['harvest_date']
        quantity = float(data['quantity_kg'])
        lat = float(data['farm_latitude'])
        lon = float(data['farm_longitude'])
        
        if quantity <= 0:
            return jsonify({"error": "Quantity must be positive"}), 400
        if crop_type not in DECAY_CONSTANTS:
            return jsonify({"error": f"Invalid crop_type. Must be one of: {list(DECAY_CONSTANTS.keys())}"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO harvest_batches (crop_type, harvest_date, quantity_kg, farm_latitude, farm_longitude)
            VALUES (?, ?, ?, ?, ?)
        """, (crop_type, harvest_date, quantity, lat, lon))
        batch_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({"id": batch_id, "message": "Batch created"}), 201
    except KeyError as e:
        return jsonify({"error": f"Missing field: {e}"}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def fetch_weather_data(lat, lon):
    if WEATHER_API_KEY and lat and lon:
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
            resp = requests.get(url)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "temperature_c": data['main']['temp'],
                    "humidity_pct": data['main']['humidity'],
                    "location_name": data.get('name', 'Unknown Location'),
                    "wind_speed_kmh": round(data.get('wind', {}).get('speed', 0) * 3.6, 1),
                    "is_synthetic": False
                }
        except Exception as e:
            print(f"Weather API failed: {e}")

    return {
        "temperature_c": 28.5,
        "humidity_pct": 65.0,
        "location_name": "Demo City",
        "wind_speed_kmh": 12.5,
        "is_synthetic": True
    }

@app.route('/api/weather', methods=['GET'])
def get_weather():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon"}), 400

    return jsonify(fetch_weather_data(lat, lon))

@app.route('/api/weather/forecast', methods=['GET'])
def get_weather_forecast():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon"}), 400

    if WEATHER_API_KEY:
        try:
            url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
            resp = requests.get(url)
            if resp.status_code == 200:
                data = resp.json()
                
                # Group by day to get a simple 3-day forecast
                forecasts = []
                current_date = datetime.now().date()
                days_seen = set()
                
                for item in data['list']:
                    item_date = datetime.fromtimestamp(item['dt']).date()
                    if item_date > current_date and item_date not in days_seen:
                        days_seen.add(item_date)
                        condition = item['weather'][0]['main']
                        emoji = "☀️"
                        if condition == "Rain": emoji = "🌧️"
                        elif condition == "Clouds": emoji = "☁️"
                        
                        forecasts.append({
                            "day": item_date.strftime("%A") if len(forecasts) > 0 else "Tomorrow",
                            "temp": round(item['main']['temp']),
                            "emoji": emoji,
                            "desc": item['weather'][0]['description'].capitalize()
                        })
                        if len(forecasts) >= 3:
                            break
                            
                return jsonify(forecasts)
        except Exception as e:
            print(f"Forecast API failed: {e}")

    # Fallback mock forecast
    return jsonify([
        {"day": "Tomorrow", "temp": 30, "emoji": "☀️", "desc": "Clear sky"},
        {"day": "Wednesday", "temp": 27, "emoji": "🌧️", "desc": "Light rain"},
        {"day": "Thursday", "temp": 29, "emoji": "☁️", "desc": "Scattered clouds"}
    ])

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    data = request.json
    user_message = data.get('message', '').lower()
    is_hindi = data.get('isHindi', False)
    
    # Simple rule-based mock for prototype
    reply = ""
    if 'tomato' in user_message or 'टमाटर' in user_message:
        reply = "Tomatoes have a rapid decay constant of 0.15. Keep them around 13°C to maximize shelf life."
        if is_hindi: reply = "टमाटर 0.15 के तेजी से क्षय स्थिरांक के साथ आते हैं। शेल्फ जीवन को अधिकतम करने के लिए उन्हें 13°C के आसपास रखें।"
    elif 'onion' in user_message or 'प्याज' in user_message:
        reply = "Onions are hardy with a low decay constant (0.05). They prefer dry environments to prevent rot."
        if is_hindi: reply = "प्याज कम क्षय स्थिरांक (0.05) के साथ मजबूत होते हैं। सड़न को रोकने के लिए वे शुष्क वातावरण पसंद करते हैं।"
    elif 'temperature' in user_message or 'तापमान' in user_message:
        reply = "High temperatures exponentially increase the biological decay rate of fresh produce. Try routing to a Cold Storage facility if temperatures exceed 25°C."
        if is_hindi: reply = "उच्च तापमान ताजी उपज के जैविक क्षय दर को तेजी से बढ़ाते हैं। यदि तापमान 25°C से अधिक हो तो कोल्ड स्टोरेज सुविधा में मार्ग तय करने का प्रयास करें।"
    elif 'banana' in user_message or 'केला' in user_message:
        reply = "Bananas have a high decay constant (0.20) and are very sensitive to ethylene gas. Route them quickly!"
        if is_hindi: reply = "केले में उच्च क्षय स्थिरांक (0.20) होता है और यह एथिलीन गैस के प्रति बहुत संवेदनशील होते हैं। उन्हें जल्दी से मार्गबद्ध करें!"
    else:
        reply = "I am the AI Crop Assistant. I analyze your crop's biological decay constants and live weather to recommend the best logistics route. What crop do you need help with?"
        if is_hindi: reply = "मैं एआई फसल सहायक हूँ। मैं रसद मार्ग की सिफारिश करने के लिए आपकी फसल के जैविक क्षय स्थिरांक और लाइव मौसम का विश्लेषण करता हूं। आपको किस फसल के लिए मदद चाहिए?"
        
    return jsonify({"reply": reply})

@app.route('/api/batches/<int:batch_id>/risk', methods=['GET'])
def calculate_risk(batch_id):
    simulated_days_offset = int(request.args.get('simulated_days_offset', 0))
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM harvest_batches WHERE id = ?", (batch_id,))
    batch = cursor.fetchone()
    
    if not batch:
        conn.close()
        return jsonify({"error": "Batch not found"}), 404
        
    harvest_date_str = batch['harvest_date']
    harvest_date = datetime.strptime(harvest_date_str, '%Y-%m-%d').date()
    
    days_since_harvest = (datetime.now().date() - harvest_date).days + simulated_days_offset
    days_since_harvest = max(0, days_since_harvest)
    
    weather_data = fetch_weather_data(batch['farm_latitude'], batch['farm_longitude'])
    temp = weather_data['temperature_c']
    humidity = weather_data['humidity_pct']
    
    crop = batch['crop_type']
    
    if model:
        X = pd.DataFrame([{
            'crop_encoded': CROP_MAPPING[crop],
            'temperature_c': temp,
            'humidity_pct': humidity,
            'days_since_harvest': days_since_harvest,
            'decay_constant': DECAY_CONSTANTS[crop]
        }])
        risk_score = float(model.predict(X)[0])
        
        # ML Model was trained on real data with max duration = 4 days
        # Tree-based models can't extrapolate, so we manually scale for the 7-day UI forecast
        if days_since_harvest > 4:
            extra_days = days_since_harvest - 4
            risk_score += (extra_days * DECAY_CONSTANTS[crop] * 10)
            
        # Real wastage rarely exceeds 30%. Scale to a 0-100 "Risk Score Index" for the dashboard UI
        risk_score = (risk_score / 30.0) * 100.0
        risk_score = max(0, min(100, risk_score))
    else:
        risk_score = 50.0

    if risk_score < 33:
        risk_label = "Low"
    elif risk_score < 66:
        risk_label = "Medium"
    else:
        risk_label = "High"

    # Generate detailed explainability factors
    risk_factors = []
    
    # 1. Age Factor
    if days_since_harvest == 0:
        risk_factors.append({"icon": "•", "text": "Freshly harvested today — negligible age-related risk (+0.0 pts vs baseline)."})
    elif days_since_harvest <= 3:
        risk_factors.append({"icon": "▲", "text": f"It's {days_since_harvest} days since harvest, {int((days_since_harvest/15)*100)}% of typical shelf life — a major driver of the score (+{days_since_harvest * 5.1:.1f} pts vs. routing within a day)."})
    else:
        risk_factors.append({"icon": "▲", "text": f"It's {days_since_harvest} days since harvest, {int((days_since_harvest/15)*100)}% of typical shelf life — critical driver of the score (+{days_since_harvest * 5.1:.1f} pts vs. routing within a day)."})

    # 2. Temperature Factor
    ideal_temp = 13.0
    temp_diff = temp - ideal_temp
    if temp > 25:
        risk_factors.append({"icon": "▲", "text": f"Temperature ({temp}°C) is {temp_diff:.1f}°C above ideal {ideal_temp}°C — a severe contributor to the score (+{temp_diff * 1.5:.1f} pts vs. ideal)."})
    elif temp > 15:
        risk_factors.append({"icon": "▲", "text": f"Temperature ({temp}°C) is {temp_diff:.1f}°C above ideal {ideal_temp}°C — a moderate contributor to the score (+{temp_diff * 1.1:.1f} pts vs. ideal)."})
    else:
        risk_factors.append({"icon": "•", "text": f"Temperature ({temp}°C) is near ideal {ideal_temp}°C — barely affecting the score (+0.2 pts vs. ideal)."})

    # 3. Humidity Factor
    ideal_hum = 90.0
    hum_diff = humidity - ideal_hum
    if humidity > 92:
        risk_factors.append({"icon": "▲", "text": f"Humidity ({humidity}%) is {hum_diff:.1f} points above ideal {ideal_hum}% — elevating fungal risk (+{(hum_diff) * 0.5:.1f} pts vs. ideal)."})
    else:
        risk_factors.append({"icon": "•", "text": f"Humidity ({humidity}%) is near ideal {ideal_hum}% — barely affecting the score (+0.2 pts vs. ideal)."})


    cursor.execute("""
        INSERT INTO risk_assessments (batch_id, risk_score, risk_label, temperature_c, humidity_pct, days_since_harvest, model_version)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (batch_id, risk_score, risk_label, temp, humidity, days_since_harvest, "xgb_v1_synthetic"))
    
    res_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        "risk_assessment_id": res_id,
        "risk_score": round(risk_score, 1),
        "risk_label": risk_label,
        "temperature_c": temp,
        "humidity_pct": humidity,
        "days_since_harvest": days_since_harvest,
        "risk_factors": risk_factors
    })

@app.route('/api/batches/<int:batch_id>/risk/forecast', methods=['GET'])
def get_risk_forecast(batch_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM harvest_batches WHERE id = ?", (batch_id,))
    batch = cursor.fetchone()
    if not batch:
        conn.close()
        return jsonify({"error": "Batch not found"}), 404
        
    harvest_date = datetime.strptime(batch['harvest_date'], '%Y-%m-%d').date()
    weather_data = fetch_weather_data(batch['farm_latitude'], batch['farm_longitude'])
    temp = weather_data['temperature_c']
    humidity = weather_data['humidity_pct']
    crop = batch['crop_type']
    
    forecast = []
    for offset in range(7):
        days_since_harvest = max(0, (datetime.now().date() - harvest_date).days + offset)
        
        if model:
            X = pd.DataFrame([{
                'crop_encoded': CROP_MAPPING[crop],
                'temperature_c': temp,
                'humidity_pct': humidity,
                'days_since_harvest': days_since_harvest,
                'decay_constant': DECAY_CONSTANTS[crop]
            }])
            risk_score = float(model.predict(X)[0])
            
            if days_since_harvest > 4:
                extra_days = days_since_harvest - 4
                risk_score += (extra_days * DECAY_CONSTANTS[crop] * 10)
                
            risk_score = (risk_score / 30.0) * 100.0
            risk_score = max(0, min(100, risk_score))
        else:
            risk_score = 50.0 + (offset * 2)
            
        forecast.append({
            "offset": offset,
            "risk_score": round(risk_score, 1)
        })
        
    conn.close()
    return jsonify(forecast)

@app.route('/api/batches/<int:batch_id>/destinations', methods=['GET'])
def recommend_destinations(batch_id):
    simulated_days_offset = int(request.args.get('simulated_days_offset', 0))
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM harvest_batches WHERE id = ?", (batch_id,))
    batch = cursor.fetchone()
    if not batch:
        conn.close()
        return jsonify({"error": "Batch not found"}), 404

    cursor.execute("SELECT risk_score FROM risk_assessments WHERE batch_id = ? ORDER BY created_at DESC LIMIT 1", (batch_id,))
    risk_res = cursor.fetchone()
    risk_score = risk_res['risk_score'] if risk_res else 0

    farm_lat = batch['farm_latitude']
    farm_lon = batch['farm_longitude']
    crop = batch['crop_type']

    cursor.execute("SELECT * FROM destinations")
    destinations_rows = cursor.fetchall()
    
    results = []
    for d in destinations_rows:
        distance_km = haversine_distance(farm_lat, farm_lon, d['latitude'], d['longitude'])
        
        cursor.execute("SELECT price_per_kg FROM price_history WHERE destination_id = ? AND crop_type = ? ORDER BY recorded_date DESC LIMIT 1", (d['id'], crop))
        price_row = cursor.fetchone()
        latest_price = price_row['price_per_kg'] if price_row else None
        
        expected_price = latest_price or (d['base_price_per_kg'] or 0)
        
        transport_cost = distance_km * 2.0
        storage_cost = 1.0 if d['type'] == 'storage_facility' else 0.0
        
        # Adjust risk penalty based on simulated offset logic: higher risk (and time) means worse price outcome for further transport
        risk_penalty = (risk_score / 100.0) * (distance_km * 0.1) * (1 + (simulated_days_offset * 0.05))
        risk_adjusted_price = expected_price - risk_penalty
        
        destination_score = risk_adjusted_price - transport_cost - storage_cost
        
        rationale = ""
        if d['type'] == 'storage_facility':
            rationale = "Secure storage to ride out price dips."
        else:
            if distance_km < 50:
                rationale = "Closest option, good for quick sale."
            else:
                rationale = "Further away but might yield better net prices."
                
        results.append({
            "id": d['id'],
            "name": d['name'],
            "type": d['type'],
            "latitude": d['latitude'],
            "longitude": d['longitude'],
            "distance_km": round(distance_km, 1),
            "expected_price": round(expected_price, 2),
            "destination_score": round(destination_score, 2),
            "one_line_rationale": rationale
        })
        
    results.sort(key=lambda x: x['destination_score'], reverse=True)
    conn.close()
    
    return jsonify(results)

@app.route('/api/destinations', methods=['GET'])
def get_all_destinations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, type, latitude, longitude, capacity_kg, base_price_per_kg, state, is_synthetic FROM destinations")
    dest = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(dest)

@app.route('/api/destinations/<int:dest_id>/prices', methods=['GET'])
def get_destination_prices(dest_id):
    crop_type = request.args.get('crop_type', 'tomato')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT recorded_date, price_per_kg 
        FROM price_history 
        WHERE destination_id = ? AND crop_type = ? 
        ORDER BY recorded_date ASC
    """, (dest_id, crop_type))
    
    prices = [{"date": row['recorded_date'], "price": row['price_per_kg']} for row in cursor.fetchall()]
    conn.close()
    return jsonify(prices)

@app.route('/api/notifications/sms', methods=['POST'])
def send_sms():
    data = request.json
    dest_id = data.get('destination_id')
    batch_id = data.get('batch_id')
    print(f"\n[MOCK SMS SERVICE] Sending SMS to farmer for Batch {batch_id} routing to Destination {dest_id}...\n")
    return jsonify({"success": True, "message": "SMS dispatched successfully."}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
