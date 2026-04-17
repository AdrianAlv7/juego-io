import tiledMapRaw from "../../../tiled/map.json?raw";
import tiledPreviewUrl from "../../../tiled/map.png";
import CountdownSystem from "../race/systems/CountdownSystem.js";
import ObjectiveSystem from "../race/systems/ObjectiveSystem.js";
import PlayerHealthSystem from "../race/systems/PlayerHealthSystem.js";
import RouteGuideSystem from "../race/systems/RouteGuideSystem.js";
import MotoHealthSystem from "../race/systems/MotoHealthSystem.js";
import TrackItemSystem from "../../items/TrackItemSystem.js";
import BuildingFakeDepth from "../fakeDepth/BuildingFakeDepth.js";
import { createFakeDepthCityLayout } from "../fakeDepth/fakeDepthCityLayout.js";
import { formatKm, speedPxPerSecToKmh } from "../race/utils/telemetry.js";

const TILED_PREVIEW_TEXTURE_KEY = "tiled-preview-map";
const TILED_PREVIEW_SCALE = 11;
const FAKE_DEPTH_RENDER_BASE_DEPTH = -36;

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
  spawnPoint: { x: 75, y: 680, angle: 0 },
});
const TRAIN_BLOCKS_RAW = Object.freeze({
  marketStreet: {
    id: "marketStreet",
    label: "Tren en Mercado",
    center: { x: 700, y: 520 },
    size: { width: 190, height: 38 },
    orientation: "horizontal",
    cars: 4,
  },
  riverCrossing: {
    id: "riverCrossing",
    label: "Tren en Cruce Rio",
    center: { x: 860, y: 739 },
    size: { width: 38, height: 195 },
    orientation: "vertical",
    cars: 4,
  },
  depotLane: {
    id: "depotLane",
    label: "Tren en Deposito",
    center: { x: 1170, y: 307 },
    size: { width: 176, height: 36 },
    orientation: "horizontal",
    cars: 3,
  },
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

function scaleTrainBlock(block) {
  const center = scalePoint(block.center);
  const width = block.size.width * TILED_PREVIEW_SCALE;
  const height = block.size.height * TILED_PREVIEW_SCALE;
  return {
    ...block,
    center,
    width,
    height,
    rect: {
      left: center.x - width / 2,
      right: center.x + width / 2,
      top: center.y - height / 2,
      bottom: center.y + height / 2,
      width,
      height,
    },
  };
}

const TRAIN_BLOCKS = Object.freeze(
  Object.fromEntries(
    Object.entries(TRAIN_BLOCKS_RAW).map(([id, block]) => [id, scaleTrainBlock(block)])
  )
);

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
    this.activeTrainEvent = null;
    this.trainGraphics = scene.add.graphics().setDepth(-15);
    this.trainShadowGraphics = scene.add.graphics().setDepth(-16);
    this.fakeDepthBuildings = [];
    this.trackItems = new TrackItemSystem(scene, {
      localPlayerId: options.localPlayerId || "",
      onTrigger: options.onTrackItemTriggered,
    });

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

    const fakeDepthLayout = createFakeDepthCityLayout(sourceImage, {
      scale: TILED_PREVIEW_SCALE,
    });
    this.fakeDepthBuildings = fakeDepthLayout.buildings.map((config) => {
      const renderDepth =
        FAKE_DEPTH_RENDER_BASE_DEPTH +
        (Number(config.y || 0) + Number(config.height || 0)) * 0.001;
      return new BuildingFakeDepth(scene, {
        ...config,
        depth: renderDepth,
      });
    });
    this.updateCameraDrivenDecor();

    this.collisionMask = buildCollisionMask(sourceImage);

    this.countdown = new CountdownSystem(scene, {
      preStartMs: TILED_PREVIEW_TUNING.preStartMs,
      goVisibleMs: TILED_PREVIEW_TUNING.goVisibleMs,
    });

    this.objectives = new ObjectiveSystem(scene, {
      basePoint: this.basePoint,
      orders: this.layout.orders,
      onObjectiveCompleted: options.onObjectiveCompleted,
      onObjectiveServiceStarted: options.onObjectiveServiceStarted,
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
      damageInterceptor: options.packageDamageInterceptor,
    });

    this.motoHealth = new MotoHealthSystem({
      maxHealth: TILED_PREVIEW_TUNING.motoMaxHealth,
      minImpactForDamage: TILED_PREVIEW_TUNING.motoMinImpactForDamage,
      collisionDamageFactor: TILED_PREVIEW_TUNING.motoCollisionDamageFactor,
      collisionCooldownMs: TILED_PREVIEW_TUNING.collisionDamageCooldownMs,
      repairDurationMs: TILED_PREVIEW_TUNING.motoRepairDurationMs,
      damageInterceptor: options.motoDamageInterceptor,
    });

    scene.events.once("shutdown", () => {
      this.destroy();
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
      ghostBypassed: false,
    };
  }

  startTrainEvent(payload = {}) {
    const block = TRAIN_BLOCKS[payload.id];
    if (!block) return;

    this.activeTrainEvent = {
      ...payload,
      block,
    };
    this.drawTrainBlock(block);
    this.objectives.showEventMessage(
      `${block.label}: calle cerrada`,
      "#ff9e7a",
      1800
    );
  }

  endTrainEvent() {
    if (!this.activeTrainEvent) return;
    const label = this.activeTrainEvent.block?.label || "Tren";
    this.activeTrainEvent = null;
    this.trainGraphics.clear();
    this.trainShadowGraphics.clear();
    this.objectives.showEventMessage(`${label}: via libre`, "#9cf5b8", 1400);
  }

  setTrackItems(items = []) {
    this.trackItems.setItems(items);
  }

  upsertTrackItem(payload = {}) {
    this.trackItems.upsertItem(payload);
  }

  removeTrackItem(id) {
    this.trackItems.removeItem(id);
  }

  setGuideSuppressed(suppressed) {
    this.guide.setSuppressed(Boolean(suppressed));
  }

  setCountdownSuppressed(suppressed) {
    this.countdown?.setSuppressed?.(Boolean(suppressed));
  }

  updateCameraDrivenDecor(camera = this.scene.cameras.main) {
    this.fakeDepthBuildings.forEach((building) => building.update(camera));
  }

  getMotoMaxHealth() {
    return this.motoHealth.maxHealth;
  }

  drawTrainBlock(block) {
    this.trainGraphics.clear();
    this.trainShadowGraphics.clear();

    const { rect, orientation, cars } = block;
    const thickness = Math.min(rect.width, rect.height);
    const shadowPadding = Math.max(18, Math.round(thickness * 0.08));
    const cornerRadius = Math.max(14, Math.round(thickness * 0.12));
    const borderWidth = Math.max(5, Math.round(thickness * 0.015));
    const separatorInset = Math.max(14, Math.round(thickness * 0.17));
    const windowInset = Math.max(16, Math.round(thickness * 0.15));
    const wheelInset = Math.max(26, Math.round(thickness * 0.23));
    const wheelRadius = Math.max(8, Math.round(thickness * 0.02));
    const horizontalWindowWidth = Math.max(
      48,
      Math.round((rect.width / Math.max(2, cars)) * 0.34)
    );
    const horizontalWindowHeight = Math.max(18, Math.round(thickness * 0.12));
    const verticalWindowWidth = Math.max(18, Math.round(thickness * 0.12));
    const verticalWindowHeight = Math.max(
      48,
      Math.round((rect.height / Math.max(2, cars)) * 0.34)
    );

    this.trainShadowGraphics.fillStyle(0x000000, 0.18);
    this.trainShadowGraphics.fillRoundedRect(
      rect.left - shadowPadding,
      rect.top - shadowPadding,
      rect.width + shadowPadding * 2,
      rect.height + shadowPadding * 2,
      cornerRadius
    );

    this.trainGraphics.fillStyle(0x9c1f1f, 1);
    this.trainGraphics.fillRoundedRect(
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      cornerRadius
    );
    this.trainGraphics.lineStyle(borderWidth, 0xf4d35e, 0.95);
    this.trainGraphics.strokeRoundedRect(
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      cornerRadius
    );

    const carCount = Math.max(2, Number(cars || 3));
    for (let index = 1; index < carCount; index += 1) {
      if (orientation === "horizontal") {
        const x = rect.left + (rect.width / carCount) * index;
        this.trainGraphics.lineStyle(Math.max(4, Math.round(borderWidth * 0.9)), 0x1d1d1d, 0.65);
        this.trainGraphics.beginPath();
        this.trainGraphics.moveTo(x, rect.top + separatorInset);
        this.trainGraphics.lineTo(x, rect.bottom - separatorInset);
        this.trainGraphics.strokePath();
      } else {
        const y = rect.top + (rect.height / carCount) * index;
        this.trainGraphics.lineStyle(Math.max(4, Math.round(borderWidth * 0.9)), 0x1d1d1d, 0.65);
        this.trainGraphics.beginPath();
        this.trainGraphics.moveTo(rect.left + separatorInset, y);
        this.trainGraphics.lineTo(rect.right - separatorInset, y);
        this.trainGraphics.strokePath();
      }
    }

    this.trainGraphics.fillStyle(0xf1f1f1, 0.95);
    if (orientation === "horizontal") {
      for (let index = 0; index < carCount; index += 1) {
        const windowX =
          rect.left +
          rect.width * ((index + 0.5) / carCount) -
          horizontalWindowWidth / 2;
        this.trainGraphics.fillRoundedRect(
          windowX,
          rect.top + windowInset,
          horizontalWindowWidth,
          horizontalWindowHeight,
          8
        );
        this.trainGraphics.fillRoundedRect(
          windowX,
          rect.bottom - windowInset - horizontalWindowHeight,
          horizontalWindowWidth,
          horizontalWindowHeight,
          8
        );
      }
    } else {
      for (let index = 0; index < carCount; index += 1) {
        const windowY =
          rect.top +
          rect.height * ((index + 0.5) / carCount) -
          verticalWindowHeight / 2;
        this.trainGraphics.fillRoundedRect(
          rect.left + windowInset,
          windowY,
          verticalWindowWidth,
          verticalWindowHeight,
          8
        );
        this.trainGraphics.fillRoundedRect(
          rect.right - windowInset - verticalWindowWidth,
          windowY,
          verticalWindowWidth,
          verticalWindowHeight,
          8
        );
      }
    }

    this.trainGraphics.fillStyle(0x232323, 0.95);
    if (orientation === "horizontal") {
      for (let index = 0; index < 6; index += 1) {
        const wheelX = rect.left + wheelInset + index * ((rect.width - wheelInset * 2) / 5);
        this.trainGraphics.fillCircle(wheelX, rect.bottom + wheelRadius, wheelRadius);
        this.trainGraphics.fillCircle(wheelX, rect.top - wheelRadius, wheelRadius);
      }
    } else {
      for (let index = 0; index < 6; index += 1) {
        const wheelY = rect.top + wheelInset + index * ((rect.height - wheelInset * 2) / 5);
        this.trainGraphics.fillCircle(rect.left - wheelRadius, wheelY, wheelRadius);
        this.trainGraphics.fillCircle(rect.right + wheelRadius, wheelY, wheelRadius);
      }
    }
  }

  enforceTrainCollision(moto, collisionInfo) {
    const contactState = this.contactStateByMoto.get(moto) || {
      colliding: false,
      trainBlocked: false,
    };
    this.contactStateByMoto.set(moto, contactState);

    const block = this.activeTrainEvent?.block;
    if (!block) {
      contactState.trainBlocked = false;
      return collisionInfo;
    }

    const clearance = Math.max(
      18,
      Math.round(
        Math.min(moto?.sprite?.displayWidth || 0, moto?.sprite?.displayHeight || 0) * 0.18
      )
    );
    const { x, y } = moto.sprite;
    const rect = block.rect;
    const inside =
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom;

    if (!inside) {
      contactState.trainBlocked = false;
      return collisionInfo;
    }
    if (moto?.shouldBypassCollision?.(this.scene.time.now)) {
      contactState.trainBlocked = false;
      return {
        ...this.getCollisionInfoDefaults(collisionInfo.speedKmh),
        ghostBypassed: true,
      };
    }

    const distances = [
      { edge: "left", value: Math.abs(x - rect.left) },
      { edge: "right", value: Math.abs(rect.right - x) },
      { edge: "top", value: Math.abs(y - rect.top) },
      { edge: "bottom", value: Math.abs(rect.bottom - y) },
    ].sort((a, b) => a.value - b.value);

    let targetX = x;
    let targetY = y;
    const nearestEdge = distances[0]?.edge || "left";
    if (nearestEdge === "left") targetX = rect.left - clearance;
    if (nearestEdge === "right") targetX = rect.right + clearance;
    if (nearestEdge === "top") targetY = rect.top - clearance;
    if (nearestEdge === "bottom") targetY = rect.bottom + clearance;

    const justCollided = !contactState.trainBlocked;
    contactState.trainBlocked = true;
    moto.sprite.setPosition(targetX, targetY);
    moto.sprite.body.updateFromGameObject();
    moto.velX *= 0.2;
    moto.velY *= 0.2;
    moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);

    return {
      collided: true,
      justCollided,
      damageEvent: false,
      impact: 0.2,
      penetration: distances[0]?.value || 0,
      speedKmh: collisionInfo.speedKmh,
      ghostBypassed: false,
    };
  }

  enforceRoadCollision(moto) {
    const speedKmh = speedPxPerSecToKmh(moto.speedPxPerSec);
    const contactState = this.contactStateByMoto.get(moto) || {
      colliding: false,
      trainBlocked: false,
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

      return this.enforceTrainCollision(moto, this.getCollisionInfoDefaults(speedKmh));
    }

    const nearestRoadPosition = this.findNearestRoadPosition(
      moto.sprite.x,
      moto.sprite.y
    );
    const fallbackPosition =
      nearestRoadPosition || this.safeRoadPositions.get(moto) || this.spawnPoint;
    const nowMs = Number(this.scene?.time?.now || Date.now());
    if (moto?.shouldBypassCollision?.(nowMs)) {
      contactState.colliding = false;
      return this.enforceTrainCollision(moto, {
        ...this.getCollisionInfoDefaults(speedKmh),
        ghostBypassed: true,
      });
    }

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

    return this.enforceTrainCollision(moto, {
      collided: true,
      justCollided,
      damageEvent: justCollided,
      impact: outwardSpeed + correctionLength / (TILED_PREVIEW_SCALE * 2.4),
      penetration: correctionLength,
      speedKmh,
    });
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
    moto.handleTrackCollision?.(collisionInfo);

    let itemResult = null;
    if (!locked && !repairing) {
      itemResult = this.trackItems.handleLocalMoto(moto, nowMs);
      if (itemResult?.collisionInfo) {
        moto.handleTrackCollision?.(itemResult.collisionInfo);
      }
    }
    const hasGhostCollisionContact = Boolean(
      collisionInfo?.collided ||
        collisionInfo?.ghostBypassed ||
        itemResult?.collisionInfo?.collided ||
        itemResult?.collisionInfo?.ghostBypassed ||
        itemResult?.ghostBypassed
    );
    moto.updateGhostCollisionContact?.(hasGhostCollisionContact, nowMs);

    this.health.applyCollision(collisionInfo, nowMs);
    this.motoHealth.applyCollision(collisionInfo, nowMs);
    if (itemResult?.wallDamagePercent) {
      this.motoHealth.applyDirectDamagePercent(itemResult.wallDamagePercent, nowMs);
    }
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

  getRaceProgress(moto) {
    return {
      ...this.objectives.getProgressSnapshot(moto),
      liveQualityPercent: this.health.getAverageQualityPercent(),
    };
  }

  getMatchStats(moto) {
    const healthData = this.health.getHudData();
    return {
      elapsedMs: this.getElapsedRaceTimeMs(),
      qualityPercent: healthData.qualityPercent,
      deliveredCount: healthData.deliveredCount,
      totalOrders: healthData.totalOrders,
      progress: this.getRaceProgress(moto),
    };
  }

  getMinimapData() {
    return {
      type: "image",
      textureKey: TILED_PREVIEW_TEXTURE_KEY,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
    };
  }

  getMinimapTarget() {
    const objective = this.objectives.getCurrentObjective?.();
    if (!objective || this.objectives.isFinished()) return null;

    return {
      x: objective.x,
      y: objective.y,
      kind: objective.kind,
      label: objective.label,
      color: objective.color,
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

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.guide?.destroy?.();
    this.objectives?.destroy?.();
    this.countdown?.destroy?.();
    this.trackItems?.destroy?.();
    this.fakeDepthBuildings.forEach((building) => building.destroy());
    this.fakeDepthBuildings = [];
    this.trainGraphics?.destroy?.();
    this.trainShadowGraphics?.destroy?.();
    this.background?.destroy?.();
    this.preview?.destroy?.();
  }
}
