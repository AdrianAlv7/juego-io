import Phaser from "phaser";

export const HUD_MAX_SPEED_KMH = 230;
export const KMH_PER_PX_PER_SEC = 0.13;
export const KM_PER_PX = KMH_PER_PX_PER_SEC / 3600;

export function speedPxPerSecToKmh(speedPxPerSec) {
  const safeSpeed = Number(speedPxPerSec || 0);
  return Math.max(0, safeSpeed * KMH_PER_PX_PER_SEC);
}

export function speedPxPerSecToHudRatio(speedPxPerSec) {
  return Phaser.Math.Clamp(speedPxPerSecToKmh(speedPxPerSec) / HUD_MAX_SPEED_KMH, 0, 1);
}

export function distancePxToKm(distancePx) {
  const safeDistance = Number(distancePx || 0);
  return Math.max(0, safeDistance * KM_PER_PX);
}

export function formatKm(distancePx, digits = 2) {
  return `${distancePxToKm(distancePx).toFixed(digits)} km`;
}
