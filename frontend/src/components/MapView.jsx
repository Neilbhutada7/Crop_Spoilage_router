import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { rankColor } from "../colors";

const ZOOM_ON_CLICK = 12;
const FLY_DURATION_S = 1.1;

const MAHARASHTRA_CENTER = [19.7515, 75.7139];

// Classic teardrop map pin (rotated-square trick), the shape everyone
// recognizes from Google Maps -- a plain colored dot read as more
// "AI generated" than this, so it's worth the extra markup.
function pinIcon(color, size = 26, label) {
  const inner = size * 0.62;
  return L.divIcon({
    className: "",
    html: `<div style="
        width:${size}px;height:${size}px;
        border-radius:50% 50% 50% 0;
        background:${color};
        border:2px solid white;
        box-shadow:0 2px 5px rgba(0,0,0,0.35);
        transform:rotate(-45deg);
        position:relative;
      ">
        <div style="
          transform:rotate(45deg);
          width:${size}px;height:${size}px;
          display:flex;align-items:center;justify-content:center;
          color:white;font-weight:700;font-size:${inner * 0.5}px;
        ">${label ?? ""}</div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [points, map]);
  return null;
}

export default function MapView({ destinations, farmLocation, topDestinationId }) {
  const { t } = useTranslation();
  const isRanked = destinations.length > 0 && destinations[0].rank !== undefined;
  const total = destinations.length;
  const mapRef = useRef(null);

  const fitPoints = [
    ...destinations.map((d) => ({ lat: d.latitude, lng: d.longitude })),
    ...(farmLocation ? [{ lat: farmLocation.latitude, lng: farmLocation.longitude }] : []),
  ];

  const topDestination = topDestinationId
    ? destinations.find((d) => (d.destination_id ?? d.id) === topDestinationId)
    : null;
  const routePoints =
    farmLocation && topDestination
      ? [[farmLocation.latitude, farmLocation.longitude], [topDestination.latitude, topDestination.longitude]]
      : null;

  function flyToPoint(lat, lng) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), ZOOM_ON_CLICK), { duration: FLY_DURATION_S });
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer ref={mapRef} center={MAHARASHTRA_CENTER} zoom={7} style={{ height: "100%", minHeight: 520, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <FitBounds points={fitPoints} />

        {routePoints && (
          <Polyline positions={routePoints} pathOptions={{ color: "#4f46e5", weight: 2.5, opacity: 0.75, dashArray: "1 10", lineCap: "round" }} />
        )}

        {farmLocation && (
          <Marker
            position={[farmLocation.latitude, farmLocation.longitude]}
            icon={pinIcon("#f59e0b", 26)}
            eventHandlers={{ click: () => flyToPoint(farmLocation.latitude, farmLocation.longitude) }}
          >
            <Popup>
              <strong>{t("mapLegend.farmLocation")}:</strong> {farmLocation.name}
            </Popup>
          </Marker>
        )}

        {destinations.map((d) => {
          const unrankedColor = d.type === "mandi" ? "#db2777" : "#4f46e5";
          const color = isRanked ? rankColor(d.rank, total) : unrankedColor;
          return (
            <Marker
              key={d.destination_id ?? d.id}
              position={[d.latitude, d.longitude]}
              icon={pinIcon(color, d.rank === 1 ? 30 : 24, isRanked ? d.rank : "")}
              eventHandlers={{ click: () => flyToPoint(d.latitude, d.longitude) }}
            >
              <Popup>
                <div className="popup-content">
                  <strong>{d.name}</strong>
                  <div className="popup-badge">{d.type === "mandi" ? t("mapLegend.mandi") : t("mapLegend.storageFacility")}</div>
                  {d.distance_km !== undefined && <div>{d.distance_km} {t("mapLegend.away")}</div>}
                  {d.expected_price !== undefined && <div>{t("mapLegend.expectedPrice")}: ₹{d.expected_price}/kg</div>}
                  {d.one_line_rationale && <div className="popup-rationale">{d.one_line_rationale}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="absolute bottom-3.5 left-3.5 z-[500] flex gap-3.5 px-3.5 py-2 rounded-lg bg-white/95 border border-gray-200 shadow-sm text-[11px] text-gray-600 flex-wrap max-w-[calc(100%-28px)]">
        {isRanked ? (
          <>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#16a34a" }} /> {t("mapLegend.best")}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#d97706" }} /> {t("mapLegend.moderate")}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#dc2626" }} /> {t("mapLegend.worst")}</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#4f46e5" }} /> {t("mapLegend.storageFacility")}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#db2777" }} /> {t("mapLegend.mandi")}</span>
          </>
        )}
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} /> {t("mapLegend.farmLocation")}</span>
      </div>
    </div>
  );
}
