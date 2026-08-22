import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../services/googleMapsService";
import { computeRoute } from "../services/routeService";

const MAHARASHTRA_CENTER = { lat: 19.7515, lng: 75.7139 };

function pinElement(color, size = 26) {
  const div = document.createElement("div");
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  div.style.borderRadius = "50% 50% 50% 0";
  div.style.background = color;
  div.style.border = "2px solid white";
  div.style.boxShadow = "0 2px 5px rgba(0,0,0,0.35)";
  div.style.transform = "rotate(-45deg)";
  return div;
}

// Google Maps JavaScript API + Routes API (computeRoutes), used only when
// VITE_GOOGLE_MAPS_API_KEY is set -- RoutePlanner falls back to the
// Leaflet/OSM MapView otherwise. This draws the actual road route rather
// than a straight line whenever the Routes API call succeeds; if it
// doesn't (rate limit, network), it falls back to a plain dashed line
// between the two points rather than silently showing nothing.
export default function GoogleRouteMap({ farmLocation, recommended, alternatives, selectedId, onSelectDestination }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const [error, setError] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const selected = selectedId
    ? [recommended, ...alternatives].find((d) => d?.destination_id === selectedId) || recommended
    : recommended;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: MAHARASHTRA_CENTER,
          zoom: 7,
          // AdvancedMarkerElement requires a Map ID registered in Cloud
          // Console (Maps Management -> Map IDs). Replace this placeholder
          // once you create one there -- it doesn't need custom styling.
          mapId: "AGRIROUTE_ROUTE_PLANNER",
          disableDefaultUI: false,
          streetViewControl: false,
        });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map || !farmLocation || !recommended) return;

    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();
    const addMarker = (position, color, title, onClick) => {
      const marker = new maps.marker.AdvancedMarkerElement({
        map, position, title, content: pinElement(color),
      });
      if (onClick) marker.addListener("click", onClick);
      markersRef.current.push(marker);
      bounds.extend(position);
    };

    addMarker({ lat: farmLocation.latitude, lng: farmLocation.longitude }, "#f59e0b", `Farm: ${farmLocation.name}`);
    addMarker(
      { lat: recommended.latitude, lng: recommended.longitude },
      "#16a34a",
      recommended.name,
      () => onSelectDestination?.(recommended)
    );
    alternatives.forEach((d) => {
      addMarker(
        { lat: d.latitude, lng: d.longitude },
        "#9ca3af",
        d.name,
        () => onSelectDestination?.(d)
      );
    });

    map.fitBounds(bounds, 60);
  }, [farmLocation, recommended, alternatives, onSelectDestination]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map || !farmLocation || !selected) return;

    let cancelled = false;
    if (polylineRef.current) polylineRef.current.setMap(null);

    computeRoute(farmLocation, selected).then((route) => {
      if (cancelled) return;
      setRouteInfo(route);
      const path = route?.encodedPolyline
        ? maps.geometry.encoding.decodePath(route.encodedPolyline)
        : [
            { lat: farmLocation.latitude, lng: farmLocation.longitude },
            { lat: selected.latitude, lng: selected.longitude },
          ];
      polylineRef.current = new maps.Polyline({
        path,
        map,
        strokeColor: "#4f46e5",
        strokeOpacity: route?.encodedPolyline ? 0.85 : 0,
        strokeWeight: 4,
        ...(route?.encodedPolyline
          ? {}
          : { strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.7, scale: 3 }, offset: "0", repeat: "12px" }] }),
      });
    });

    return () => { cancelled = true; };
  }, [farmLocation, selected]);

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-red-500 bg-red-50">
        Google Maps failed to load: {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {routeInfo && !routeInfo.encodedPolyline && (
        <div className="absolute top-3 left-3 z-[500] px-2.5 py-1 rounded-md bg-white/95 border border-gray-200 text-[10px] text-gray-500 shadow-sm">
          Approximate line — road route unavailable from Routes API right now
        </div>
      )}
    </div>
  );
}
