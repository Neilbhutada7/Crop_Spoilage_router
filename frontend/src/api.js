// Relative by default: this app is single-origin (Flask serves the built
// frontend AND the API from the same domain/port -- see app.py's
// send_from_directory setup), so "/api" correctly reaches the backend
// whether that's localhost:5000 in dev or the real deployed domain.
// A hardcoded "http://localhost:5000/api" default only ever worked on the
// machine that built it -- every visitor to a real deployment would have
// their own browser try to reach localhost on THEIR OWN computer instead
// of the server, failing every request (login included) with no useful
// error. Set VITE_API_BASE_URL only if the API is ever served from a
// different origin than the frontend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // send/receive the session cookie for auth
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

async function requestMultipart(path, formData) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData, // no Content-Type header -- the browser sets the multipart boundary itself
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  health: () => request("/health"),
  getFarmLocations: () => request("/farm-locations"),
  getDestinations: () => request("/destinations"),
  getBatches: () => request("/batches"),
  markBatchSold: (batchId, actual = {}) =>
    request(`/batches/${batchId}/sold`, { method: "POST", body: JSON.stringify(actual) }),
  getPredictedVsActual: (batchId) => request(`/batches/${batchId}/predicted-vs-actual`),
  getNotifications: () => request("/notifications"),
  createBatch: (payload) =>
    request("/batches", { method: "POST", body: JSON.stringify(payload) }),
  getBatchRisk: (batchId) => request(`/batches/${batchId}/risk`),
  getBatchDestinations: (batchId) => request(`/batches/${batchId}/destinations`),
  getRiskForecast: (batchId, days = 6) => request(`/batches/${batchId}/risk-forecast?days=${days}`),
  getModelInfo: () => request("/model-info"),
  getPriceHistory: (destinationId, cropType) =>
    request(`/destinations/${destinationId}/price-history?crop=${cropType}`),
  getWeather: (lat, lon, date) =>
    request(`/weather?lat=${lat}&lon=${lon}${date ? `&date=${date}` : ""}`),
  getWeatherForecast: (lat, lon, days = 5) =>
    request(`/weather-forecast?lat=${lat}&lon=${lon}&days=${days}`),
  askAssistant: (question, farmLocation, lang = "en", { batchId, history } = {}) =>
    request("/assistant/ask", {
      method: "POST",
      body: JSON.stringify({
        question,
        farm_latitude: farmLocation?.latitude,
        farm_longitude: farmLocation?.longitude,
        lang,
        batch_id: batchId,
        history,
      }),
    }),
  analyzePhoto: (file, cropType, { batchId, destinationId } = {}) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("crop_type", cropType);
    if (batchId) formData.append("batch_id", batchId);
    if (destinationId) formData.append("destination_id", destinationId);
    return requestMultipart("/photo/analyze", formData);
  },
  signup: (username, password, fullName) =>
    request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, full_name: fullName }),
    }),
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
};
