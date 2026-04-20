const DEFAULT_DASHBOARD_MODE = "dual";

export const DASHBOARD_MODE_STORAGE_KEY = "deliver_hud_dashboard_mode";
export const LEGACY_DASHBOARD_MODE_STORAGE_KEY = "repartidor_hud_dashboard_mode";

export const DASHBOARD_MODE_SEQUENCE = Object.freeze([
  "dual",
  "hybrid",
  "digital",
  "lcd",
]);

export const GARAGE_DASHBOARD_MODE_SEQUENCE = Object.freeze([
  "dual",
  "digital",
  "hybrid",
  "lcd",
]);

export const DASHBOARD_MODE_META = Object.freeze({
  dual: Object.freeze({
    id: "dual",
    label: "Analog",
    garageLabel: "Analogico",
    garageDescription: "Doble reloj con velocidad y RPM.",
  }),
  digital: Object.freeze({
    id: "digital",
    label: "Digital",
    garageLabel: "Digital",
    garageDescription: "Lectura grande con barra de RPM.",
  }),
  hybrid: Object.freeze({
    id: "hybrid",
    label: "Mixto",
    garageLabel: "Mixto",
    garageDescription: "Velocidad digital y RPM analogicas.",
  }),
  lcd: Object.freeze({
    id: "lcd",
    label: "LCD",
    garageLabel: "LCD",
    garageDescription: "Pantalla compacta tipo panel.",
  }),
});

let sessionRandomDashboardMode = null;

function resolveStorage(explicitStorage = null) {
  if (explicitStorage) return explicitStorage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function pickSessionRandomDashboardMode() {
  if (sessionRandomDashboardMode) {
    return sessionRandomDashboardMode;
  }

  const pool = DASHBOARD_MODE_SEQUENCE.filter((modeId) => DASHBOARD_MODE_META[modeId]);
  const randomIndex = Math.floor(Math.random() * Math.max(1, pool.length));
  sessionRandomDashboardMode = normalizeDashboardMode(pool[randomIndex] || DEFAULT_DASHBOARD_MODE);
  return sessionRandomDashboardMode;
}

export function normalizeDashboardMode(modeId) {
  const normalized = String(modeId || "")
    .trim()
    .toLowerCase();
  return DASHBOARD_MODE_META[normalized]?.id || DEFAULT_DASHBOARD_MODE;
}

export function getDashboardModeMeta(modeId) {
  return DASHBOARD_MODE_META[normalizeDashboardMode(modeId)];
}

export function loadSelectedDashboardMode(explicitStorage = null) {
  const storage = resolveStorage(explicitStorage);
  if (!storage) return pickSessionRandomDashboardMode();

  const savedMode =
    storage.getItem(DASHBOARD_MODE_STORAGE_KEY) ||
    storage.getItem(LEGACY_DASHBOARD_MODE_STORAGE_KEY);
  if (savedMode) {
    const normalizedSavedMode = normalizeDashboardMode(savedMode);
    sessionRandomDashboardMode = normalizedSavedMode;
    return normalizedSavedMode;
  }

  return pickSessionRandomDashboardMode();
}

export function saveSelectedDashboardMode(modeId, explicitStorage = null) {
  const storage = resolveStorage(explicitStorage);
  const normalizedMode = normalizeDashboardMode(modeId);
  sessionRandomDashboardMode = normalizedMode;
  if (!storage) return normalizedMode;

  storage.setItem(DASHBOARD_MODE_STORAGE_KEY, normalizedMode);
  storage.removeItem(LEGACY_DASHBOARD_MODE_STORAGE_KEY);
  return normalizedMode;
}
