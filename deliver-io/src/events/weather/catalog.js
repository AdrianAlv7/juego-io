export const WEATHER_EVENT_TYPES = Object.freeze({
  NONE: "none",
  RAIN: "rain",
  SUNNY: "sunny",
  NIGHT: "night",
  EARTHQUAKE: "earthquake",
});

export const WEATHER_EVENT_CONFIG = Object.freeze({
  [WEATHER_EVENT_TYPES.RAIN]: Object.freeze({
    type: WEATHER_EVENT_TYPES.RAIN,
    label: "Lluvia",
    durationMs: 12000,
    overlayColor: 0x6ea7ff,
    overlayAlpha: 0.16,
    accentColor: "#8fbeff",
    handling: Object.freeze({
      lateralGripMultiplier: 1.1,
      turnMultiplier: 0.88,
      dragMultiplier: 0.92,
    }),
  }),
  [WEATHER_EVENT_TYPES.SUNNY]: Object.freeze({
    type: WEATHER_EVENT_TYPES.SUNNY,
    label: "Asoleado",
    durationMs: 12000,
    overlayColor: 0xffb35a,
    overlayAlpha: 0.14,
    accentColor: "#ffc67d",
    handling: Object.freeze({}),
    heat: Object.freeze({
      maxHeat: 100,
      warningHeat: 84,
      cooldownMs: 2000,
      resumeHeat: 34,
      baseGainPerFrame: 0.48,
      highSpeedGainPerFrame: 0.85,
      sustainBonusPerFrame: 1.25,
      holdRampMs: 1400,
      passiveCoolPerFrame: 1.35,
      airCoolBonusPerFrame: 0.5,
    }),
  }),
  [WEATHER_EVENT_TYPES.NIGHT]: Object.freeze({
    type: WEATHER_EVENT_TYPES.NIGHT,
    label: "Noche",
    durationMs: 13000,
    overlayColor: 0x0a1020,
    overlayAlpha: 0,
    accentColor: "#b7c8ff",
    handling: Object.freeze({}),
    nightVision: Object.freeze({
      blockedRatio: 0.22,
      color: 0x000000,
      alpha: 1,
    }),
  }),
  [WEATHER_EVENT_TYPES.EARTHQUAKE]: Object.freeze({
    type: WEATHER_EVENT_TYPES.EARTHQUAKE,
    label: "Esta temblando",
    durationMs: 5000,
    overlayColor: 0x5d4538,
    overlayAlpha: 0.18,
    accentColor: "#ffbe98",
    handling: Object.freeze({}),
    cameraVibrationOverride: Object.freeze({
      intensity: 100,
    }),
  }),
});

export function createEmptyWeatherEventState() {
  return {
    type: WEATHER_EVENT_TYPES.NONE,
    phase: "idle",
    label: "",
    startsAtMs: 0,
    endsAtMs: 0,
    overlayColor: 0x000000,
    overlayAlpha: 0,
    accentColor: "#d7e1ef",
    cameraVibrationOverride: null,
    source: "",
  };
}
