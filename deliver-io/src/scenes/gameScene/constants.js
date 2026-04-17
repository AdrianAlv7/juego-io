// Constantes compartidas del GameScene.
// Reune tuning de simulacion, camara y utilidades puras para evitar numeros regados.
import Phaser from "phaser";

export const DEFAULT_WORLD_WIDTH = 6000;
export const DEFAULT_WORLD_HEIGHT = 6000;
export const DESIGN_VIEWPORT_WIDTH = 1920;
export const DESIGN_VIEWPORT_HEIGHT = 1080;

export const SIMULATION_FPS = 60;
export const FIXED_STEP_MS = 1000 / SIMULATION_FPS;
export const MAX_CATCH_UP_STEPS = 5;
export const MAX_ACCUMULATED_DELTA_MS = 250;
export const CAMERA_DELTA_CAP_MS = 50;
export const DELTA_SPIKE_RESET_MS = 90;
export const RESUME_STABILIZE_FRAMES = 6;
export const STARTUP_STABILIZE_FRAMES = 8;

export const CAMERA_ZOOM_SETTINGS = {
  baseZoom: 0.5,
  fastZoom: 0.4,
  viewportCompensation: 1,
  hudBaseZoom: 1,
  hudFastZoom: 0.95,
  hudDamping: 12,
};

export const CAMERA_LOOK_AHEAD_MAX = 110;
export const ZOOM_DAMPING = 8;
export const OFFSET_DAMPING = 10;

export const HIGH_SPEED_CAMERA_FEEL = {
  triggerKmh: 205,
  blendRangeKmh: 24,
  maxExtraZoomOut: 0.012,
  zoomPulseAmplitude: 0.0032,
  offsetWaveAmplitudePx: 2,
  offsetWaveFreqX: 0.012,
  offsetWaveFreqY: 0.016,
};

export const TOP_SPEED_SCREEN_FX = {
  triggerKmh: 205,
  blendRangeKmh: 42,
  baseIntensityAtTrigger: 0.58,
  extraZoomOut: 0.05,
  zoomPulseAmplitude: 0.0038,
  shakeAmplitudePx: 18,
  shakeFreqX: 0.012,
  shakeFreqXSecondary: 0.019,
  shakeSecondaryWeight: 0.32,
  shakeFreqY: 0.028,
  verticalDriftPx: 0.45,
};

export const ENGINE_VIBRATION_CAMERA_FX = {
  enabled: true,
  intensity: .2,
  idleWeight: 1,
  cruiseWeight: 0.42,
  stabilizationPower: 0.72,
  axisXMultiplier: 1.25,
  axisYMultiplier: 1,
  crossAxisMix: 0.62,
  maxOffsetXPx: 2.8,
  maxOffsetYPx: 3.6,
  maxOffsetIntensityInfluence: 0.42,
  maxOffsetCapXPx: 16,
  maxOffsetCapYPx: 22,
  damping: 18,
};
export const EARTHQUAKE_CAMERA_FX = {
  // Ajusta este valor para calar la intensidad del terremoto sin tocar mas codigo.
  // 100 = referencia base, 150 = 1.5x, 60 = 0.6x.
  fixedIntensity: 200,
  defaultIntensity: 100,
  waveAmplitudeXPxAt100: 16,
  waveAmplitudeYPxAt100: 16,
  waveFreqX: 0.072,
  waveFreqY: 0.081,
  waveFreqXSecondary: 0.118,
  waveFreqYSecondary: 0.126,
  waveSecondaryWeight: 0.64,
  microJitterXPxAt100: 5,
  microJitterYPxAt100: 5,
  microJitterFreqX: 0.167,
  microJitterFreqY: 0.173,
  maxOffsetXPxAt100: 28,
  maxOffsetYPxAt100: 28,
  damping: 28,
  fadeOutMs: 1400,
};

export const USERNAME_MAX_LENGTH = 16;
export const HUD_FILTER_REFRESH_MS = 250;
export const WEATHER_OVERLAY_DAMPING = 7;
export const WEATHER_UI_MARGIN = 18;
export const SPECTATOR_START_DELAY_MS = 2000;

export function damp(current, target, dampingPerSecond, deltaMs) {
  const t = 1 - Math.exp((-dampingPerSecond * deltaMs) / 1000);
  return Phaser.Math.Linear(current, target, t);
}
