// Green (best) -> amber -> red (worst), used consistently across the
// map markers and the ranked destination list so they stay visually linked.
// Standard, restrained saturation -- legible on white without glowing.
export function rankColor(rank, total) {
  if (total <= 1) return "hsl(142, 65%, 38%)";
  const t = (rank - 1) / (total - 1); // 0 = best, 1 = worst
  const hue = 142 - t * 142;
  return `hsl(${hue}, 68%, 40%)`;
}

// Lighter companion shade for the same rank, used as the gradient
// highlight on map markers.
export function rankColorLight(rank, total) {
  if (total <= 1) return "hsl(142, 70%, 58%)";
  const t = (rank - 1) / (total - 1);
  const hue = 142 - t * 142;
  return `hsl(${hue}, 75%, 58%)`;
}

// Risk semantic scale -- standard, readable status colors (Tailwind-ish).
export function riskColor(label) {
  if (label === "Low") return "#16a34a";
  if (label === "Medium") return "#d97706";
  return "#dc2626";
}

// Same three-way scale for the mini input gauges (temperature/humidity/days).
export function levelColor(level) {
  if (level === "Low") return "#16a34a";
  if (level === "Moderate") return "#d97706";
  return "#dc2626";
}

// Primary accent -- deep agricultural green, used consistently (buttons, active states).
export const ACCENT_COLOR = "#1a4f31";
export const ACCENT_TEXT = "#0e2f1c";

// Secondary accents: each dashboard metric/section gets its own identity
// color, kept at a standard "SaaS dashboard" saturation rather than neon.
export const ACCENT_BLUE = "#2563eb";
export const ACCENT_PURPLE = "#7c3aed";
export const ACCENT_PINK = "#db2777";
export const ACCENT_TEAL = "#0d9488";
export const ACCENT_EMERALD = "#16a34a";

export const PRICE_LINE_COLOR = "#b45309";
export const GRID_COLOR = "#e5e7eb";
