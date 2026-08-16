import os
import sqlite3
from datetime import datetime, timedelta
import random

DB_PATH = 'spoilage_router.db'

DESTINATIONS = [
    {"name": "Nashik Main Mandi", "type": "mandi", "lat": 20.0110, "lon": 73.7903, "capacity_kg": None, "base_price": 25.0, "state": "Maharashtra"},
    {"name": "Nashik Cold Storage", "type": "storage_facility", "lat": 19.9975, "lon": 73.7898, "capacity_kg": 50000, "base_price": None, "state": "Maharashtra"},
    {"name": "Pune APMC", "type": "mandi", "lat": 18.5204, "lon": 73.8567, "capacity_kg": None, "base_price": 28.0, "state": "Maharashtra"},
    {"name": "Pune Agri Storage", "type": "storage_facility", "lat": 18.5314, "lon": 73.8446, "capacity_kg": 100000, "base_price": None, "state": "Maharashtra"},
    {"name": "Nagpur Mandi", "type": "mandi", "lat": 21.1458, "lon": 79.0882, "capacity_kg": None, "base_price": 22.0, "state": "Maharashtra"},
    {"name": "Nagpur Mega Storage", "type": "storage_facility", "lat": 21.1550, "lon": 79.0900, "capacity_kg": 200000, "base_price": None, "state": "Maharashtra"}
]

CROPS = ["tomato", "onion", "banana"]

def create_tables(cursor):
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS destinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        capacity_kg INTEGER,
        base_price_per_kg REAL,
        state TEXT NOT NULL,
        is_synthetic BOOLEAN DEFAULT 1
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        destination_id INTEGER,
        crop_type TEXT NOT NULL,
        price_per_kg REAL NOT NULL,
        recorded_date TEXT NOT NULL,
        FOREIGN KEY (destination_id) REFERENCES destinations (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS harvest_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_type TEXT NOT NULL,
        harvest_date TEXT NOT NULL,
        quantity_kg REAL NOT NULL,
        farm_latitude REAL NOT NULL,
        farm_longitude REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS risk_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        risk_score REAL NOT NULL,
        risk_label TEXT NOT NULL,
        temperature_c REAL NOT NULL,
        humidity_pct REAL NOT NULL,
        days_since_harvest INTEGER NOT NULL,
        model_version TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES harvest_batches (id)
    )
    ''')

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    create_tables(cursor)

    cursor.execute("SELECT COUNT(*) FROM destinations")
    if cursor.fetchone()[0] > 0:
        print("Database already seeded.")
        return

    print("Seeding destinations...")
    for d in DESTINATIONS:
        cursor.execute("""
            INSERT INTO destinations (name, type, latitude, longitude, capacity_kg, base_price_per_kg, state, is_synthetic)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (d['name'], d['type'], d['lat'], d['lon'], d['capacity_kg'], d['base_price'], d['state'], True))
        
        dest_id = cursor.lastrowid
        
        if d['type'] == 'mandi':
            for crop in CROPS:
                current_price = d['base_price'] + random.uniform(-2, 2)
                for i in range(30):
                    date = datetime.now() - timedelta(days=30-i)
                    current_price += random.uniform(-1, 1)
                    current_price = max(5, current_price)
                    cursor.execute("""
                        INSERT INTO price_history (destination_id, crop_type, price_per_kg, recorded_date)
                        VALUES (?, ?, ?, ?)
                    """, (dest_id, crop, current_price, date.strftime('%Y-%m-%d')))
    
    conn.commit()
    conn.close()
    print("SQLite database seeding complete.")

if __name__ == '__main__':
    seed()
