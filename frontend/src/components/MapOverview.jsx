import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createColoredIcon = (color, isFarm = false) => {
  const markerHtml = `
    <div style="
      background-color: ${color};
      width: ${isFarm ? '24px' : '20px'};
      height: ${isFarm ? '24px' : '20px'};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
      ${isFarm ? 'animation: pulse 2s infinite;' : ''}
    "></div>
  `;
  return new L.divIcon({
    html: markerHtml,
    className: 'custom-div-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const icons = {
  farm: createColoredIcon('#8b5cf6', true), // Violet
  best: createColoredIcon('#10b981'),       // Green
  good: createColoredIcon('#f59e0b'),       // Orange/Gold
  poor: createColoredIcon('#ef4444')        // Red
};

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 8);
    }
  }, [center, map]);
  return null;
}

export default function MapOverview({ farmLocation, destinations }) {
  const center = farmLocation ? [farmLocation.lat, farmLocation.lon] : [19.0, 74.0];

  const getMarkerIcon = (index) => {
    if (index === 0) return icons.best;
    if (index < 3) return icons.good;
    return icons.poor;
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: '500px', width: '100%' }}>
        <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ChangeView center={center} />

          {farmLocation && (
            <Marker position={[farmLocation.lat, farmLocation.lon]} icon={icons.farm}>
              <Popup>
                <strong>Harvest Location</strong>
              </Popup>
            </Marker>
          )}

          {destinations.map((dest, idx) => (
            <Marker 
              key={dest.id} 
              position={[dest.latitude, dest.longitude]}
              icon={getMarkerIcon(idx)}
            >
              <Popup>
                <strong>{dest.name}</strong><br/>
                Type: {dest.type}<br/>
                Distance: {dest.distance_km} km<br/>
                Score: {dest.destination_score}<br/>
                <em>{dest.one_line_rationale}</em>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
