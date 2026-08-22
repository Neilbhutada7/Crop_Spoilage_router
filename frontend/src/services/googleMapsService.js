// Loads the Google Maps JavaScript API from an env-provided key --
// VITE_GOOGLE_MAPS_API_KEY (see frontend/.env.example). Never hardcode a key
// here: if the env var is empty, isGoogleMapsConfigured() returns false and
// callers (RoutePlanner) fall back to the OpenStreetMap/Leaflet map instead
// of pretending Google Maps is live.

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const CALLBACK_NAME = "__agriRouteGoogleMapsCallback";

let loadPromise = null;

export function isGoogleMapsConfigured() {
  return Boolean(API_KEY && API_KEY.trim().length > 0);
}

// Resolves once `window.google.maps` (with the routes/geometry/marker
// libraries) is available. Cached so multiple map instances share one
// script tag and one network request.
export function loadGoogleMaps() {
  if (!isGoogleMapsConfigured()) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    window[CALLBACK_NAME] = () => {
      delete window[CALLBACK_NAME];
      resolve(window.google.maps);
    };
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}` +
      `&libraries=marker,geometry&loading=async&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
