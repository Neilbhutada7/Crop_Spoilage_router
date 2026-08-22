"""
Preset farm village locations used to populate the frontend's farm
location dropdown (spec calls for a dropdown of 5-6 preset villages
rather than free-text lat/long entry, to keep the live demo reliable).

Real village/taluka names and approximate coordinates near the three
Maharashtra towns used for seeded destinations (Nashik, Pune, Nagpur).
"""

FARM_LOCATIONS = [
    {"name": "Niphad, Nashik district", "latitude": 20.0787, "longitude": 74.1102},
    {"name": "Dindori, Nashik district", "latitude": 20.2062, "longitude": 73.8354},
    {"name": "Saswad, Pune district", "latitude": 18.3400, "longitude": 74.0166},
    {"name": "Baramati, Pune district", "latitude": 18.1516, "longitude": 74.5815},
    {"name": "Kalmeshwar, Nagpur district", "latitude": 21.2300, "longitude": 78.7900},
    {"name": "Umred, Nagpur district", "latitude": 20.8500, "longitude": 79.3300},
]
