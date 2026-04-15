export const CONTROL_PRESET_STORAGE_KEY = "deliver_control_preset";
const LEGACY_CONTROL_PRESET_STORAGE_KEY = "repartidor_control_preset";

export const CONTROL_PRESET_IDS = Object.freeze({
  ARROWS: "flechitas",
  WASD: "wasd",
});

export const CONTROL_PRESETS = Object.freeze({
  [CONTROL_PRESET_IDS.ARROWS]: Object.freeze({
    id: CONTROL_PRESET_IDS.ARROWS,
    label: "Flechitas",
    movement: Object.freeze({
      up: "UP",
      down: "DOWN",
      left: "LEFT",
      right: "RIGHT",
    }),
    actions: Object.freeze({
      drift: "SHIFT",
      brake: "SPACE",
      item: "Z",
      nitro: "X",
    }),
  }),
  [CONTROL_PRESET_IDS.WASD]: Object.freeze({
    id: CONTROL_PRESET_IDS.WASD,
    label: "WASD",
    movement: Object.freeze({
      up: "W",
      down: "S",
      left: "A",
      right: "D",
    }),
    actions: Object.freeze({
      drift: "SHIFT",
      brake: "SPACE",
      item: "K",
      nitro: "L",
    }),
  }),
});

export const CONTROL_GUIDE_ROWS = Object.freeze({
  [CONTROL_PRESET_IDS.ARROWS]: Object.freeze([
    Object.freeze({ key: "UP", action: "Acelerar" }),
    Object.freeze({ key: "DOWN", action: "Reversa" }),
    Object.freeze({ key: "LEFT", action: "Girar izquierda" }),
    Object.freeze({ key: "RIGHT", action: "Girar derecha" }),
    Object.freeze({ key: "SHIFT", action: "Drift" }),
    Object.freeze({ key: "SPACE", action: "Freno" }),
    Object.freeze({ key: "Z", action: "Soltar item" }),
    Object.freeze({ key: "X", action: "Nitro" }),
  ]),
  [CONTROL_PRESET_IDS.WASD]: Object.freeze([
    Object.freeze({ key: "W", action: "Acelerar" }),
    Object.freeze({ key: "S", action: "Reversa" }),
    Object.freeze({ key: "A", action: "Girar izquierda" }),
    Object.freeze({ key: "D", action: "Girar derecha" }),
    Object.freeze({ key: "SHIFT", action: "Drift" }),
    Object.freeze({ key: "SPACE", action: "Freno" }),
    Object.freeze({ key: "K", action: "Soltar item" }),
    Object.freeze({ key: "L", action: "Nitro" }),
  ]),
});

export function normalizeControlPresetId(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === CONTROL_PRESET_IDS.WASD) return CONTROL_PRESET_IDS.WASD;
  return CONTROL_PRESET_IDS.ARROWS;
}

export function getControlPreset(presetId) {
  return CONTROL_PRESETS[normalizeControlPresetId(presetId)];
}

export function getControlGuideRows(presetId) {
  return CONTROL_GUIDE_ROWS[normalizeControlPresetId(presetId)] || [];
}

export function loadControlPresetId() {
  if (typeof window === "undefined" || !window.localStorage) {
    return CONTROL_PRESET_IDS.ARROWS;
  }

  const stored =
    window.localStorage.getItem(CONTROL_PRESET_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_CONTROL_PRESET_STORAGE_KEY) ||
    CONTROL_PRESET_IDS.ARROWS;
  return normalizeControlPresetId(stored);
}

export function saveControlPresetId(presetId) {
  const normalized = normalizeControlPresetId(presetId);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(CONTROL_PRESET_STORAGE_KEY, normalized);
  }
  return normalized;
}
