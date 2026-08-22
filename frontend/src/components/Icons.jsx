// Minimal inline SVG icon set -- no icon-library dependency, keeps the
// bundle small and every icon themeable via currentColor.
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconGauge = (p) => (
  <svg {...base} {...p}><path d="M12 20a8 8 0 1 0-8-8" /><path d="M12 20v-8" /><path d="M12 12l4-3" /></svg>
);
export const IconWarehouse = (p) => (
  <svg {...base} {...p}><path d="M3 21V10l9-6 9 6v11" /><path d="M3 10h18" /><rect x="9" y="13" width="6" height="8" /></svg>
);
export const IconTag = (p) => (
  <svg {...base} {...p}><path d="M20.5 12.5 12 21l-9-9L11.5 3H20a1 1 0 0 1 1 1v8.5Z" /><circle cx="15.5" cy="7.5" r="1.5" /></svg>
);
export const IconMapPin = (p) => (
  <svg {...base} {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
);
export const IconThermometer = (p) => (
  <svg {...base} {...p}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z" /></svg>
);
export const IconDroplet = (p) => (
  <svg {...base} {...p}><path d="M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13Z" /></svg>
);
export const IconClock = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconTrendingUp = (p) => (
  <svg {...base} {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
);
export const IconLayers = (p) => (
  <svg {...base} {...p}><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
);
export const IconLeaf = (p) => (
  <svg {...base} {...p}><path d="M11 20A7 7 0 0 1 4 13c0-6 6-11 15-11 0 9-5 15-11 15-1.5 0-3-.5-4-1Z" /><path d="M4 20 15 9" /></svg>
);
export const IconCalendar = (p) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
);
export const IconScale = (p) => (
  <svg {...base} {...p}><path d="M12 3v18M7 7l-4 8a4 4 0 0 0 8 0l-4-8ZM17 7l-4 8a4 4 0 0 0 8 0l-4-8ZM5 7h14" /></svg>
);
export const IconBell = (p) => (
  <svg {...base} {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);
export const IconSparkle = (p) => (
  <svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>
);
export const IconGrid = (p) => (
  <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);
export const IconSearch = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);
export const IconRefresh = (p) => (
  <svg {...base} {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
);
export const IconBarChart = (p) => (
  <svg {...base} {...p}><path d="M3 21h18" /><rect x="6" y="11" width="3.5" height="8" /><rect x="13.5" y="6" width="3.5" height="13" /><rect x="18" y="14" width="3" height="5" /></svg>
);
export const IconRoute = (p) => (
  <svg {...base} {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 7.3C11 10 13 13.5 15.8 16.7" /></svg>
);
export const IconTruck = (p) => (
  <svg {...base} {...p}><rect x="1" y="6" width="14" height="11" rx="1" /><path d="M15 10h4l3 3v4h-7z" /><circle cx="6" cy="19" r="1.8" /><circle cx="17.5" cy="19" r="1.8" /></svg>
);
export const IconSettings = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const IconAlertTriangle = (p) => (
  <svg {...base} {...p}><path d="M10.3 3.9 1.8 18a1.6 1.6 0 0 0 1.4 2.4h17.6a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
);
export const IconChevronRight = (p) => (
  <svg {...base} {...p}><path d="m9 18 6-6-6-6" /></svg>
);
export const IconLogOut = (p) => (
  <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
);
export const IconPlay = (p) => (
  <svg {...base} {...p}><path d="M7 4v16l14-8Z" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IconX = (p) => (
  <svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const IconMenu = (p) => (
  <svg {...base} {...p}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
);
export const IconDatabase = (p) => (
  <svg {...base} {...p}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
);
export const IconExternalLink = (p) => (
  <svg {...base} {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
);
export const IconZap = (p) => (
  <svg {...base} {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
);
export const IconCamera = (p) => (
  <svg {...base} {...p}><path d="M4 8h3l2-2h6l2 2h3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const IconMic = (p) => (
  <svg {...base} {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5M9 22h6" /></svg>
);
export const IconVolume = (p) => (
  <svg {...base} {...p}><path d="M4 9v6h4l5 5V4L8 9H4Z" /><path d="M17.5 8.5a5 5 0 0 1 0 7" /></svg>
);
export const IconShield = (p) => (
  <svg {...base} {...p}><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" /></svg>
);
export const IconStar = (p) => (
  <svg {...base} {...p}><path d="m12 2 3.1 6.6 7 .9-5.2 4.9 1.4 7-6.3-3.6-6.3 3.6 1.4-7L2 9.5l7-.9L12 2Z" /></svg>
);
