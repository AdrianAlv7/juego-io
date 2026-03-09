import tiledMapRaw from "../../../tiled/mapa1.json?raw";
import tiledPreviewUrl from "../../../tiled/map.png";
import CountdownSystem from "../race/systems/CountdownSystem.js";
import ObjectiveSystem from "../race/systems/ObjectiveSystem.js";
import PlayerHealthSystem from "../race/systems/PlayerHealthSystem.js";
import RouteGuideSystem from "../race/systems/RouteGuideSystem.js";
import MotoHealthSystem from "../race/systems/MotoHealthSystem.js";
import { formatKm, speedPxPerSecToKmh } from "../race/utils/telemetry.js";

const TILED_PREVIEW_TEXTURE_KEY = "tiled-preview-map";
const TILED_PREVIEW_SCALE = 9;

const ROAD_COVERAGE_SAMPLE_RADIUS = 1.4;
const ROAD_COVERAGE_THRESHOLD = 0.34;
const ROAD_EDGE_SEARCH_RADIUS = 10;
const ROAD_EDGE_PADDING = 0.8;
const SAFE_CONTACT_RATIO = 0.55;

const ROAD_COLOR = Object.freeze({
  r: 95,
  g: 87,
  b: 79,
  tolerance: 6,
  minAlpha: 220,
});

const TILED_PREVIEW_TUNING = Object.freeze({
  pickupRadius: 240,
  dropoffRadius: 220,
  returnRadius: 260,
  serviceTimeMs: 1000,
  preStartMs: 3000,
  goVisibleMs: 900,
  defaultEventDurationMs: 2000,
  maxHealth: 100,
  minImpactForDamage: 0.9,
  collisionDamageFactor: 0.14,
  collisionDamageCooldownMs: 180,
  motoMaxHealth: 210,
  motoMinImpactForDamage: 0.75,
  motoCollisionDamageFactor: 0.09,
  motoRepairDurationMs: 1800,
  contactReleaseThreshold: 0.52,
  sustainedTangentDamping: 0.72,
});

const ORDERS_PER_MATCH = 3;

const TILED_PREVIEW_LAYOUT_RAW = Object.freeze({
  spawnPoint: { x: 300, y: 730, angle: 0 },
});

const PICKUP_POINT_POOL_RAW = Object.freeze([
  { x: 180, y: 300 },
  { x: 250, y: 275 },
  { x: 650, y: 275 },
  { x: 856, y: 243 },
  { x: 910, y: 330 },
  { x: 1040, y: 680 },
  { x: 1180, y: 600 },
  { x: 1160, y: 920 },
]);

const DROPOFF_POINT_POOL_RAW = Object.freeze([
  { x: 1280, y: 130 },
  { x: 1199, y: 307 },
  { x: 1224, y: 680 },
  { x: 1120, y: 714 },
  { x: 860, y: 739 },
  { x: 740, y: 680 },
  { x: 640, y: 520 },
  { x: 288, y: 500 },
]);

const TILED_MAP_DATA = JSON.parse(tiledMapRaw);

function scalePoint(point) {
  return {
    ...point,
    x: point.x * TILED_PREVIEW_SCALE,
    y: point.y * TILED_PREVIEW_SCALE,
  };
}

function scaleOrder(order) {
  return {
    pickup: scalePoint(order.pickup),
    dropoff: scalePoint(order.dropoff),
  };
}

function createSeededRandom(seedValue) {
  let seed = (Number(seedValue) >>> 0) || 0x6d2b79f5;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed(list, seedValue) {
  const rng = createSeededRandom(seedValue);
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function buildOrdersForSeed(seedValue) {
  const pickupPoints = shuffleWithSeed(PICKUP_POINT_POOL_RAW, seedValue).slice(
    0,
    ORDERS_PER_MATCH
  );
  const dropoffPoints = shuffleWithSeed(
    DROPOFF_POINT_POOL_RAW,
    seedValue ^ 0x9e3779b9
  ).slice(0, ORDERS_PER_MATCH);

  return pickupPoints.map((pickup, index) => ({
    pickup: {
      ...pickup,
      label: `R${index + 1}`,
      color: 0xffbf69,
    },
    dropoff: {
      ...dropoffPoints[index],
      label: `E${index + 1}`,
      color: 0x8fd694,
    },
  }));
}

function buildTiledPreviewLayout(seedValue) {
  return Object.freeze({
    spawnPoint: scalePoint(TILED_PREVIEW_LAYOUT_RAW.spawnPoint),
    orders: buildOrdersForSeed(seedValue).map(scaleOrder),
  });
}

function extractLayerBounds(mapData) {
  const tileWidth = Number(mapData?.tilewidth) || 8;
  const tileHeight = Number(mapData?.tileheight) || 8;
  let minTileX = Infinity;
  let minTileY = Infinity;
  let maxTileX = -Infinity;
  let maxTileY = -Infinity;

  for (const layer of mapData?.layers || []) {
    if (layer?.type !== "tilelayer") continue;

    if (Array.isArray(layer.chunks) && layer.chunks.length > 0) {
      for (const chunk of layer.chunks) {
        minTileX = Math.min(minTileX, Number(chunk.x) || 0);
        minTileY = Math.min(minTileY, Number(chunk.y) || 0);
        maxTileX = Math.max(
          maxTileX,
          (Number(chunk.x) || 0) + (Number(chunk.width) || 0)
        );
        maxTileY = Math.max(
          maxTileY,
          (Number(chunk.y) || 0) + (Number(chunk.height) || 0)
        );
      }
      continue;
    }

    const layerX = Number(layer.startx ?? layer.x) || 0;
    const layerY = Number(layer.starty ?? layer.y) || 0;
    const layerWidth = Number(layer.width ?? mapData?.width) || 0;
    const layerHeight = Number(layer.height ?? mapData?.height) || 0;

    minTileX = Math.min(minTileX, layerX);
    minTileY = Math.min(minTileY, layerY);
    maxTileX = Math.max(maxTileX, layerX + layerWidth);
    maxTileY = Math.max(maxTileY, layerY + layerHeight);
  }

  if (!Number.isFinite(minTileX) || !Number.isFinite(minTileY)) {
    minTileX = 0;
    minTileY = 0;
    maxTileX = Number(mapData?.width) || 0;
    maxTileY = Number(mapData?.height) || 0;
  }

  return {
    widthPx: Math.max(0, (maxTileX - minTileX) * tileWidth),
    heightPx: Math.max(0, (maxTileY - minTileY) * tileHeight),
  };
}

function buildCollisionMask(sourceImage) {
  if (typeof document === "undefined" || !sourceImage) return null;

  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(sourceImage, 0, 0);

  return {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

function isRoadBasePixel(mask, x, y) {
  if (!mask) return true;

  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) {
    return false;
  }

  const idx = (py * mask.width + px) * 4;
  const alpha = mask.data[idx + 3];
  if (alpha < ROAD_COLOR.minAlpha) return false;

  const r = mask.data[idx];
  const g = mask.data[idx + 1];
  const b = mask.data[idx + 2];

  return (
    Math.abs(r - ROAD_COLOR.r) <= ROAD_COLOR.tolerance &&
    Math.abs(g - ROAD_COLOR.g) <= ROAD_COLOR.tolerance &&
    Math.abs(b - ROAD_COLOR.b) <= ROAD_COLOR.tolerance
  );
}

function getRoadCoverage(mask, x, y, radius = ROAD_COVERAGE_SAMPLE_RADIUS) {
  if (!mask) return 1;

  const minX = Math.floor(x - radius);
  const maxX = Math.ceil(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.ceil(y + radius);
  const radiusSq = radius * radius;

  let hits = 0;
  let total = 0;

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > radiusSq) continue;

      total += 1;
      if (isRoadBasePixel(mask, px, py)) {
        hits += 1;
      }
    }
  }

  return total > 0 ? hits / total : 0;
}

function isRoadPixel(mask, x, y) {
  return getRoadCoverage(mask, x, y) >= ROAD_COVERAGE_THRESHOLD;
}

function findNearestRoadPoint(mask, x, y, maxRadius = ROAD_EDGE_SEARCH_RADIUS) {
  if (!mask) return { x, y };
  if (isRoadPixel(mask, x, y)) return { x, y };

  let bestCandidate = null;

  for (let py = Math.floor(y - maxRadius); py <= Math.ceil(y + maxRadius); py += 1) {
    for (let px = Math.floor(x - maxRadius); px <= Math.ceil(x + maxRadius); px += 1) {
      const dx = px - x;
      const dy = py - y;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxRadius * maxRadius) continue;

      const coverage = getRoadCoverage(mask, px, py);
      if (coverage < ROAD_COVERAGE_THRESHOLD) continue;

      const score = distSq - coverage * 0.35;
      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = { x: px, y: py, score };
      }
    }
  }

  if (!bestCandidate) return null;

  const pullX = bestCandidate.x - x;
  const pullY = bestCandidate.y - y;
  const pullLength = Math.hypot(pullX, pullY);

  if (pullLength <= 0.0001) {
    return { x: bestCandidate.x, y: bestCandidate.y };
  }

  return {
    x: bestCandidate.x + (pullX / pullLength) * ROAD_EDGE_PADDING,
    y: bestCandidate.y + (pullY / pullLength) * ROAD_EDGE_PADDING,
  };
}

export function preloadTiledPreviewAssets(scene) {
  scene.load.image(TILED_PREVIEW_TEXTURE_KEY, tiledPreviewUrl);
}

export function getTiledPreviewSpawnPoint() {
  return scalePoint(TILED_PREVIEW_LAYOUT_RAW.spawnPoint);
}

export default class TiledPreviewMap {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.mapData = TILED_MAP_DATA;
    this.objectiveSeed = Number(options.objectiveSeed || scene.time.now) >>> 0;
    this.layout = buildTiledPreviewLayout(this.objectiveSeed);
    this.bounds = extractLayerBounds(this.mapData);
    this.spawnPoint = getTiledPreviewSpawnPoint();
    this.basePoint = { ...this.spawnPoint };
    this.collisionGroup = null;
    this.safeRoadPositions = new WeakMap();
    this.contactStateByMoto = new WeakMap();
    this.lastHasPackage = false;
    this.raceStartedAtMs = null;

    const previewTexture = scene.textures.get(TILED_PREVIEW_TEXTURE_KEY);
    const sourceImage = previewTexture?.getSourceImage?.();

    this.worldWidth =
      (sourceImage?.width || this.bounds.widthPx || 1539) * TILED_PREVIEW_SCALE;
    this.worldHeight =
      (sourceImage?.height || this.bounds.heightPx || 1083) * TILED_PREVIEW_SCALE;

    scene.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    this.background = scene.add
      .rectangle(
        this.worldWidth / 2,
        this.worldHeight / 2,
        this.worldWidth,
        this.worldHeight,
        0x29adff
      )
      .setDepth(-50);

    this.preview = scene.add
      .image(0, 0, TILED_PREVIEW_TEXTURE_KEY)
      .setOrigin(0, 0)
      .setScale(TILED_PREVIEW_SCALE)
      .setDepth(-40);

    this.collisionMask = buildCollisionMask(sourceImage);

    this.countdown = new CountdownSystem(scene, {
      preStartMs: TILED_PREVIEW_TUNING.preStartMs,
      goVisibleMs: TILED_PREVIEW_TUNING.goVisibleMs,
    });

    this.objectives = new ObjectiveSystem(scene, {
      basePoint: this.basePoint,
      orders: this.layout.orders,
      radii: {
        pickupRadius: TILED_PREVIEW_TUNING.pickupRadius,
        dropoffRadius: TILED_PREVIEW_TUNING.dropoffRadius,
        returnRadius: TILED_PREVIEW_TUNING.returnRadius,
      },
      serviceTimeMs: TILED_PREVIEW_TUNING.serviceTimeMs,
      defaultEventDurationMs: TILED_PREVIEW_TUNING.defaultEventDurationMs,
    });

    this.guide = new RouteGuideSystem(scene);

    this.health = new PlayerHealthSystem({
      maxHealth: TILED_PREVIEW_TUNING.maxHealth,
      minImpactForDamage: TILED_PREVIEW_TUNING.minImpactForDamage,
      collisionDamageFactor: TILED_PREVIEW_TUNING.collisionDamageFactor,
      collisionCooldownMs: TILED_PREVIEW_TUNING.collisionDamageCooldownMs,
      totalOrders: this.layout.orders.length,
    });

    this.motoHealth = new MotoHealthSystem({
      maxHealth: TILED_PREVIEW_TUNING.motoMaxHealth,
      minImpactForDamage: TILED_PREVIEW_TUNING.motoMinImpactForDamage,
      collisionDamageFactor: TILED_PREVIEW_TUNING.motoCollisionDamageFactor,
      collisionCooldownMs: TILED_PREVIEW_TUNING.collisionDamageCooldownMs,
      repairDurationMs: TILED_PREVIEW_TUNING.motoRepairDurationMs,
    });
  }

  worldToMaskPoint(x, y) {
    return {
      x: x / TILED_PREVIEW_SCALE,
      y: y / TILED_PREVIEW_SCALE,
    };
  }

  maskToWorldPoint(x, y) {
    return {
      x: x * TILED_PREVIEW_SCALE,
      y: y * TILED_PREVIEW_SCALE,
    };
  }

  getRoadCoverageAt(x, y) {
    const maskPoint = this.worldToMaskPoint(x, y);
    return getRoadCoverage(this.collisionMask, maskPoint.x, maskPoint.y);
  }

  isRoadAt(x, y) {
    const maskPoint = this.worldToMaskPoint(x, y);
    return isRoadPixel(this.collisionMask, maskPoint.x, maskPoint.y);
  }

  findNearestRoadPosition(x, y) {
    const maskPoint = this.worldToMaskPoint(x, y);
    const nearest = findNearestRoadPoint(
      this.collisionMask,
      maskPoint.x,
      maskPoint.y
    );
    if (!nearest) return null;
    return this.maskToWorldPoint(nearest.x, nearest.y);
  }

  isSafeRoadPosition(moto) {
    const radius = Math.max(
      4,
      Math.round(
        Math.min(moto?.sprite?.displayWidth || 0, moto?.sprite?.displayHeight || 0) *
          0.12
      )
    );
    const diagonalRadius = Math.round(radius * 0.72);
    const { x, y } = moto.sprite;
    const samples = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [diagonalRadius, diagonalRadius],
      [diagonalRadius, -diagonalRadius],
      [-diagonalRadius, diagonalRadius],
      [-diagonalRadius, -diagonalRadius],
    ];

    let hits = 0;
    let totalCoverage = 0;
    for (const [dx, dy] of samples) {
      const coverage = this.getRoadCoverageAt(x + dx, y + dy);
      totalCoverage += coverage;
      if (coverage >= ROAD_COVERAGE_THRESHOLD) {
        hits += 1;
      }
    }

    return (
      hits >= Math.ceil(samples.length * SAFE_CONTACT_RATIO) ||
      totalCoverage / samples.length >= ROAD_COVERAGE_THRESHOLD
    );
  }

  isPlayerLocked() {
    this.countdown.update();
    return this.countdown.isLocked() || this.objectives.isFinished();
  }

  getCollisionInfoDefaults(speedKmh) {
    return {
      collided: false,
      justCollided: false,
      damageEvent: false,
      impact: 0,
      penetration: 0,
      speedKmh,
    };
  }

  enforceRoadCollision(moto) {
    const speedKmh = speedPxPerSecToKmh(moto.speedPxPerSec);
    const contactState = this.contactStateByMoto.get(moto) || {
      colliding: false,
    };
    this.contactStateByMoto.set(moto, contactState);

    if (this.isSafeRoadPosition(moto)) {
      this.safeRoadPositions.set(moto, {
        x: moto.sprite.x,
        y: moto.sprite.y,
      });

      if (
        this.getRoadCoverageAt(moto.sprite.x, moto.sprite.y) >=
        TILED_PREVIEW_TUNING.contactReleaseThreshold
      ) {
        contactState.colliding = false;
      }

      return this.getCollisionInfoDefaults(speedKmh);
    }

    const nearestRoadPosition = this.findNearestRoadPosition(
      moto.sprite.x,
      moto.sprite.y
    );
    const fallbackPosition =
      nearestRoadPosition || this.safeRoadPositions.get(moto) || this.spawnPoint;
    const correctionX = fallbackPosition.x - moto.sprite.x;
    const correctionY = fallbackPosition.y - moto.sprite.y;
    const correctionLength = Math.hypot(correctionX, correctionY);
    const justCollided = !contactState.colliding;

    contactState.colliding = true;
    moto.sprite.setPosition(fallbackPosition.x, fallbackPosition.y);
    moto.sprite.body.updateFromGameObject();

    let nx = 0;
    let ny = -1;
    if (correctionLength > 0.0001) {
      nx = correctionX / correctionLength;
      ny = correctionY / correctionLength;
    }

    const outwardSpeed = Math.max(0, -(moto.velX * nx + moto.velY * ny));
    if (outwardSpeed > 0) {
      moto.velX += outwardSpeed * nx;
      moto.velY += outwardSpeed * ny;
    }

    const tangentX = -ny;
    const tangentY = nx;
    let tangentSpeed = moto.velX * tangentX + moto.velY * tangentY;
    if (justCollided) {
      tangentSpeed = 0;
    } else {
      tangentSpeed *= TILED_PREVIEW_TUNING.sustainedTangentDamping;
    }

    moto.velX = tangentX * tangentSpeed;
    moto.velY = tangentY * tangentSpeed;
    moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);

    if (nearestRoadPosition) {
      this.safeRoadPositions.set(moto, {
        x: fallbackPosition.x,
        y: fallbackPosition.y,
      });
    }

    return {
      collided: true,
      justCollided,
      damageEvent: justCollided,
      impact: outwardSpeed + correctionLength / (TILED_PREVIEW_SCALE * 2.4),
      penetration: correctionLength,
      speedKmh,
    };
  }

  enforcePlayer(moto) {
    this.countdown.update();
    const locked = this.countdown.isLocked();
    const nowMs = this.scene.time.now;
    const repairing = this.motoHealth.isRepairing(nowMs);

    if (!locked && !repairing && this.raceStartedAtMs === null) {
      this.raceStartedAtMs = nowMs;
    }

    this.objectives.update(moto, locked || repairing);
    this.guide.update(
      moto,
      this.objectives.getCurrentObjective(),
      this.objectives.isFinished()
    );

    const riderState = this.objectives.getRiderState();
    if (riderState.hasPackage && !this.lastHasPackage) {
      this.health.startPackage();
    } else if (!riderState.hasPackage && this.lastHasPackage) {
      this.health.completePackageDelivery();
      this.health.clearPackage();
    }
    this.lastHasPackage = riderState.hasPackage;

    const collisionInfo = this.enforceRoadCollision(moto);
    this.health.applyCollision(collisionInfo, nowMs);
    this.motoHealth.applyCollision(collisionInfo, nowMs);
    this.motoHealth.update(nowMs, moto);
  }

  getElapsedRaceTimeMs() {
    if (this.raceStartedAtMs === null) return 0;
    const nowMs = this.scene.time.now;
    const finishMs = this.objectives.finishTimeMs || nowMs;
    const endMs = this.objectives.isFinished() ? finishMs : nowMs;
    return Math.max(0, endMs - this.raceStartedAtMs);
  }

  getHudInfo(moto) {
    const orderData = this.objectives.getOrderProgressData(moto);
    const healthData = this.health.getHudData();

    let destination = `${orderData.phaseLabel}: ${orderData.destinationLabel}`;
    if (orderData.distancePx > 0) {
      destination = `${destination} (${formatKm(orderData.distancePx)})`;
    }

    return {
      delivery: {
        currentOrder: orderData.currentOrder,
        totalOrders: orderData.totalOrders,
        destination,
        packageHealthPercent: healthData.packageHealthPercent,
        packageHealthColor: healthData.packageHealthColor,
        qualityPercent: healthData.qualityPercent,
        qualityColor: healthData.qualityColor,
        deliveredCount: healthData.deliveredCount,
      },
      timing: {
        elapsedMs: this.getElapsedRaceTimeMs(),
        countdownLabel: this.countdown.getLabel(),
      },
      moto: this.motoHealth.getHudData(this.scene.time.now),
    };
  }

  getMatchStats() {
    const healthData = this.health.getHudData();
    return {
      elapsedMs: this.getElapsedRaceTimeMs(),
      qualityPercent: healthData.qualityPercent,
      deliveredCount: healthData.deliveredCount,
      totalOrders: healthData.totalOrders,
    };
  }

  getSpawnPoint() {
    return { ...this.spawnPoint };
  }

  getCollisionGroup() {
    return this.collisionGroup;
  }

  isMatchFinished() {
    return this.objectives.isFinished();
  }

  isRiderRepairing() {
    return this.motoHealth.isRepairing(this.scene.time.now);
  }
}
