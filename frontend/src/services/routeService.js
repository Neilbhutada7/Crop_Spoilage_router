// Thin wrapper around Google's Routes API (routes.googleapis.com) --
// the current computeRoutes / computeRouteMatrix endpoints, not the legacy
// DirectionsService / Distance Matrix API. Every function resolves to
// `null` (never throws, never fabricates) when no API key is configured or
// the request fails, so callers can fall back to the existing
// PostGIS-distance-based estimate without a try/catch at every call site.

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

function waypoint({ latitude, longitude }) {
  return { location: { latLng: { latitude, longitude } } };
}

function isConfigured() {
  return Boolean(API_KEY && API_KEY.trim().length > 0);
}

// Real road route (origin -> destination) with an actual polyline to draw,
// plus a traffic-aware duration if Google's routing engine returns one.
// Returns null (not a guess) if unconfigured or the request fails.
export async function computeRoute(origin, destination) {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: waypoint(origin),
        destination: waypoint(destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        units: "METRIC",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    const durationSec = parseInt(route.duration, 10) || null;
    const staticDurationSec = parseInt(route.staticDuration, 10) || null;
    return {
      distanceMeters: route.distanceMeters,
      durationSec,
      staticDurationSec,
      // Only present (and only ever shown in the UI) when Google actually
      // returned two different figures -- never invented client-side.
      trafficDelaySec:
        staticDurationSec && durationSec && durationSec > staticDurationSec
          ? durationSec - staticDurationSec
          : null,
      encodedPolyline: route.polyline?.encodedPolyline || null,
    };
  } catch {
    return null;
  }
}

// Distance + duration from one origin to many candidate destinations in a
// single request -- used to compare candidate markets. Returns null on
// failure/unconfigured; otherwise an array aligned to `destinations`
// (by destinationIndex), each entry `{ distanceMeters, durationSec } | null`.
export async function computeRouteMatrix(origin, destinations) {
  if (!isConfigured() || destinations.length === 0) return null;
  try {
    const res = await fetch(MATRIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: [{ waypoint: waypoint(origin) }],
        destinations: destinations.map((d) => ({ waypoint: waypoint(d) })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });
    if (!res.ok) return null;
    const elements = await res.json();
    const out = new Array(destinations.length).fill(null);
    for (const el of elements) {
      if (el.condition !== "ROUTE_EXISTS") continue;
      out[el.destinationIndex] = {
        distanceMeters: el.distanceMeters,
        durationSec: parseInt(el.duration, 10) || null,
      };
    }
    return out;
  } catch {
    return null;
  }
}

export { isConfigured as isRouteApiConfigured };
