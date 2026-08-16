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

const createColoredIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const icons = {
  farm: createColoredIcon('violet'),
  best: createColoredIcon('green'),
  good: createColoredIcon('gold'),
  poor: createColoredIcon('red')
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
