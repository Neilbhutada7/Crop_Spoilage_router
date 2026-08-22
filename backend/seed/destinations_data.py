"""
Synthetic destination dataset: real Maharashtra town coordinates, real
government-published cold-storage capacity figures, synthetic per-facility
occupancy and prices (is_synthetic=True on every row).

Storage facility capacity_kg is grounded in a real published national
figure -- Ministry of Food Processing Industries / PIB, "Cold Storage
Facilities in the Country" (PRID 1658114): India had 8,186 cold storage
facilities totalling 374.25 lakh MT of capacity, i.e. an average of
~4,572 MT (4,572,000 kg) per facility. This app's demo facilities are
seeded at that real national average rather than an arbitrary round
number. What's still genuinely synthetic, because no public live feed of
per-facility occupancy exists anywhere in India (checked -- data.gov.in
only publishes static state-level aggregate totals, no API, no
per-facility granularity): available_capacity_kg (how much of that
capacity is free right now). That distinction is exactly what
availability_source="DEMO_AVAILABILITY" on the model flags -- the ceiling
is real, the live occupancy is not. Mandi capacity_kg is not used by any
capacity constraint in this app (see destination_service.py -- only
storage_facility rows get an availability_status), so it's left as an
illustrative round number.
"""

REAL_AVG_COLD_STORAGE_CAPACITY_KG = 4_572_000  # PIB PRID 1658114, see module docstring

DESTINATIONS = [
    {
        "name": "Nashik APMC Mandi",
        "type": "mandi",
        "latitude": 19.9975,
        "longitude": 73.7898,
        "capacity_kg": 80000,
        "base_price_per_kg": 18.0,
        "state": "Maharashtra",
    },
    {
        "name": "Nashik Cold Storage Hub",
        "type": "storage_facility",
        "latitude": 20.0110,
        "longitude": 73.7645,
        "capacity_kg": REAL_AVG_COLD_STORAGE_CAPACITY_KG,
        "base_price_per_kg": 16.0,
        "state": "Maharashtra",
        "available_capacity_kg": round(REAL_AVG_COLD_STORAGE_CAPACITY_KG * 0.63),
    },
    {
        "name": "Pune Market Yard (Gultekdi)",
        "type": "mandi",
        "latitude": 18.5074,
        "longitude": 73.8646,
        "capacity_kg": 100000,
        "base_price_per_kg": 20.0,
        "state": "Maharashtra",
    },
    {
        "name": "Talegaon Cold Chain Storage",
        "type": "storage_facility",
        "latitude": 18.7358,
        "longitude": 73.6753,
        "capacity_kg": REAL_AVG_COLD_STORAGE_CAPACITY_KG,
        "base_price_per_kg": 17.0,
        "state": "Maharashtra",
        "available_capacity_kg": round(REAL_AVG_COLD_STORAGE_CAPACITY_KG * 0.09),
    },
    {
        "name": "Nagpur Kalamna Mandi",
        "type": "mandi",
        "latitude": 21.1732,
        "longitude": 79.1234,
        "capacity_kg": 90000,
        "base_price_per_kg": 17.5,
        "state": "Maharashtra",
    },
    {
        "name": "Nagpur MIDC Cold Storage",
        "type": "storage_facility",
        "latitude": 21.0850,
        "longitude": 79.0450,
        "capacity_kg": REAL_AVG_COLD_STORAGE_CAPACITY_KG,
        "base_price_per_kg": 15.5,
        "state": "Maharashtra",
        "available_capacity_kg": 0,
    },
]

# Illustrative wholesale base prices (INR/kg) used as the random-walk
# starting point for synthetic price history -- modeled on typical
# Agmarknet price ranges, not pulled from a live feed. Live prices are
# preferred over this at request time when available -- see
# services/mandi_price_service.py.
CROP_BASE_PRICES = {
    "tomato": 18.0,
    "onion": 20.0,
    "banana": 14.0,
    "potato": 15.0,
    "mango": 35.0,
}
