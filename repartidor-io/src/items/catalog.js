export const ITEM_TYPES = Object.freeze({
  OIL: "oil",
  WALL: "wall",
  EMP: "emp",
  SHIELD: "shield",
});

export const ITEM_MAX_PER_PLAYER = 2;
export const ITEM_COLLISION_REPORT_COOLDOWN_MS = 450;

export const ITEM_CONFIG = Object.freeze({
  [ITEM_TYPES.OIL]: Object.freeze({
    type: ITEM_TYPES.OIL,
    label: "Aceite",
    placementOffset: 78,
    rotationOffset: 0,
    width: 228,
    height: 74,
    effectDurationMs: 3000,
    removalDelayMs: 1500,
    brakeLocked: true,
    clearsOnCollision: true,
    handling: Object.freeze({
      lateralGripMultiplier: 1.12,
      turnMultiplier: 0.88,
      dragMultiplier: 0.92,
    }),
    draw: Object.freeze({
      color: 0x090909,
      alpha: 0.96,
      edgeColor: 0x2a2a2a,
      edgeAlpha: 0.45,
      shadowAlpha: 0.2,
    }),
  }),
  [ITEM_TYPES.WALL]: Object.freeze({
    type: ITEM_TYPES.WALL,
    label: "Muro",
    placementOffset: 18,
    rotationOffset: Math.PI / 2,
    width: 188,
    height: 34,
    damagePercent: 20,
    draw: Object.freeze({
      color: 0xf5d86b,
      stripeColor: 0x1f1f1f,
      edgeColor: 0xffffff,
      shadowAlpha: 0.22,
    }),
  }),
  [ITEM_TYPES.EMP]: Object.freeze({
    type: ITEM_TYPES.EMP,
    label: "PEM",
    radius: 520,
    pulseVisualDurationMs: 560,
    effectDurationMs: 5000,
    initialSpeedFactor: 0.74,
    handling: Object.freeze({
      lateralGripMultiplier: 1.03,
      turnMultiplier: 0.9,
      dragMultiplier: 1.15,
      enginePowerMultiplier: 0.78,
    }),
    draw: Object.freeze({
      color: 0x6cc6ff,
      ringColor: 0xffffff,
    }),
  }),
  [ITEM_TYPES.SHIELD]: Object.freeze({
    type: ITEM_TYPES.SHIELD,
    label: "Escudo",
  }),
});

export const STOCK_ITEM_CONFIG = Object.freeze({
  turbo: Object.freeze({
    startingCharges: 2,
    maxCharges: 3,
    debugMaxCharges: 9,
    durationMs: 950,
    forwardImpulse: 10.5,
    autoThrottlePower: 0.52,
    autoThrottleMinFactor: 0.22,
    handling: Object.freeze({
      dragMultiplier: 0.9,
      enginePowerMultiplier: 1.9,
      brakeMultiplier: 0.3,
    }),
    maxSpeedMultiplier: 1.3,
  }),
});

function normalizeAngle(angle) {
  const value = Number(angle) || 0;
  return Number.isFinite(value) ? value : 0;
}

function offsetPoint(x, y, angle, distance) {
  return {
    x: x + Math.cos(angle) * distance,
    y: y + Math.sin(angle) * distance,
  };
}

export function isItemType(type) {
  return Boolean(ITEM_CONFIG[type]);
}

export function getItemLabel(type) {
  return ITEM_CONFIG[type]?.label || "Item";
}

export function createInventoryState(items = []) {
  return {
    items: items.map((type, index) => ({
      slot: index,
      type,
      label: getItemLabel(type),
    })),
    maxItems: ITEM_MAX_PER_PLAYER,
  };
}

export function buildDroppedItemPayload(type, ownerId, state = {}, id, createdAt = Date.now()) {
  const config = ITEM_CONFIG[type];
  if (!config) return null;

  const baseAngle = normalizeAngle(state.angle);
  const spawnPoint = offsetPoint(
    Number(state.x) || 0,
    Number(state.y) || 0,
    baseAngle + Math.PI,
    config.placementOffset
  );

  return {
    id,
    type,
    ownerId,
    x: Number(spawnPoint.x.toFixed(2)),
    y: Number(spawnPoint.y.toFixed(2)),
    angle: Number((baseAngle + (config.rotationOffset || 0)).toFixed(4)),
    createdAt,
  };
}
