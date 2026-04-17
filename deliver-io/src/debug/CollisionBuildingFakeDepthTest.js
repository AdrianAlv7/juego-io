import Phaser from "phaser";
import BuildingFakeDepth from "./BuildingFakeDepth.js";

const HOUSE_PRESETS = Object.freeze([
  Object.freeze({
    width: 300,
    height: 200,
    fakeHeight: 34,
    baseColor: 0x6e6a64,
    sideColor: 0x4f4b46,
    roofColor: 0xc97d5a,
    parallaxStrength: 0.13,
  }),
  Object.freeze({
    width: 340,
    height: 220,
    fakeHeight: 48,
    baseColor: 0x6d6a66,
    sideColor: 0x4d4a47,
    roofColor: 0xc68e5e,
    parallaxStrength: 0.12,
  }),
  Object.freeze({
    width: 280,
    height: 190,
    fakeHeight: 30,
    baseColor: 0x676563,
    sideColor: 0x484744,
    roofColor: 0xb96f52,
    parallaxStrength: 0.14,
  }),
]);

const STORE_PRESETS = Object.freeze([
  Object.freeze({
    width: 400,
    height: 250,
    fakeHeight: 72,
    baseColor: 0x696b67,
    sideColor: 0x4a4a47,
    roofColor: 0xd79845,
    parallaxStrength: 0.16,
  }),
  Object.freeze({
    width: 440,
    height: 270,
    fakeHeight: 84,
    baseColor: 0x676c68,
    sideColor: 0x494e4a,
    roofColor: 0xe1a766,
    parallaxStrength: 0.14,
  }),
  Object.freeze({
    width: 380,
    height: 240,
    fakeHeight: 66,
    baseColor: 0x676762,
    sideColor: 0x464742,
    roofColor: 0xd08949,
    parallaxStrength: 0.15,
  }),
]);

const TOWER_PRESETS = Object.freeze([
  Object.freeze({
    width: 520,
    height: 340,
    fakeHeight: 118,
    baseColor: 0x646a70,
    sideColor: 0x434b54,
    roofColor: 0x6ba6d8,
    parallaxStrength: 0.12,
  }),
  Object.freeze({
    width: 620,
    height: 390,
    fakeHeight: 146,
    baseColor: 0x686e73,
    sideColor: 0x4a5158,
    roofColor: 0x79b4e5,
    parallaxStrength: 0.1,
  }),
  Object.freeze({
    width: 500,
    height: 320,
    fakeHeight: 106,
    baseColor: 0x62696f,
    sideColor: 0x474b46,
    roofColor: 0x69a4cf,
    parallaxStrength: 0.11,
  }),
]);

const BUILDING_GROUPS = Object.freeze([
  Object.freeze({ list: HOUSE_PRESETS, weight: 0.48 }),
  Object.freeze({ list: STORE_PRESETS, weight: 0.33 }),
  Object.freeze({ list: TOWER_PRESETS, weight: 0.19 }),
]);

const WORLD_MARGIN = 180;
const SCALE_STEPS = Object.freeze([1, 0.9, 0.8, 0.72, 0.64, 0.56]);
const MIN_BUILDING_WIDTH = 150;
const MIN_BUILDING_HEIGHT = 110;
const MIN_BUILDING_FAKE_HEIGHT = 20;
const FAKE_DEPTH_TUNING = Object.freeze({
  // Multiplica el desplazamiento relativo a camara (sube/baja efecto visual).
  parallaxMultiplier: 5.2,
  // Multiplica la altura ficticia para que el techo y lateral tengan mas presencia.
  fakeHeightMultiplier: 1.7,
  // Que tan rapido sigue el techo el offset objetivo (0.05 suave, 0.3 agresivo).
  motionLerp: 0.1,
  // Limite duro de desplazamiento por eje para evitar "saltos".
  maxOffsetXPx: 8,
  maxOffsetYPx: 8,
  // Cerca del jugador se reduce el efecto; al llegar a esta distancia vuelve a 100%.
  nearDistanceForFullEffect: 170,
  // Piso minimo del efecto para que nunca se apague por completo al pasar cerca.
  minEffectStrength: 0.22,
  // 1 = mismo tamano que base, >1 hace el techo mas grande (recomendado 1.06-1.14).
  roofScale: 1.08,
  // Opacidad del techo texturizado.
  roofTextureAlpha: 1,
});

function hash01(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

function pickWeightedGroup(seed) {
  const total = BUILDING_GROUPS.reduce((sum, group) => sum + group.weight, 0);
  let cursor = hash01(seed) * total;
  for (const group of BUILDING_GROUPS) {
    cursor -= group.weight;
    if (cursor <= 0) return group.list;
  }
  return BUILDING_GROUPS[0].list;
}

function pickPresetBySeed(seed) {
  const selectedGroup = pickWeightedGroup(seed);
  const index = Math.floor(hash01(seed * 1.77 + 17) * selectedGroup.length);
  return selectedGroup[Math.max(0, Math.min(selectedGroup.length - 1, index))];
}

export default class CollisionBuildingFakeDepthTest {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.enabled = Boolean(options.enabled);
    this.toggleKey = options.toggleKey || null;
    this.map = null;
    this.moto = null;
    this.buildings = [];
  }

  setToggleKey(key) {
    this.toggleKey = key || null;
  }

  attach(map, moto = null) {
    this.map = map || null;
    this.moto = moto || null;
    this.rebuildBuildings();
    this.applyVisibility();
  }

  setMoto(moto) {
    this.moto = moto || null;
  }

  clearMap() {
    this.map = null;
    this.moto = null;
    this.destroyBuildings();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && this.map && this.buildings.length === 0) {
      this.rebuildBuildings();
    }
    this.applyVisibility();
    return this.enabled;
  }

  getBuildingCount() {
    return this.buildings.length;
  }

  applyVisibility() {
    for (const building of this.buildings) {
      building.setVisible(this.enabled);
    }
  }

  update() {
    if (!this.enabled || !this.map) return;

    const cam = this.scene.cameras?.main;
    for (const building of this.buildings) {
      building.update(cam);
    }
  }

  rebuildBuildings() {
    this.destroyBuildings();
    if (!this.map) return;

    const placements = this.findCollisionPlacements();
    for (const placement of placements) {
      if (!placement?.preset) continue;
      const building = new BuildingFakeDepth(this.scene, {
        ...placement.preset,
        fakeHeight: Math.max(
          MIN_BUILDING_FAKE_HEIGHT,
          Math.round(
            placement.preset.fakeHeight *
              Number(FAKE_DEPTH_TUNING.fakeHeightMultiplier || 1)
          )
        ),
        parallaxMultiplier: Number(FAKE_DEPTH_TUNING.parallaxMultiplier || 1),
        motionLerp: Number(FAKE_DEPTH_TUNING.motionLerp || 0.16),
        maxOffsetXPx: Number(FAKE_DEPTH_TUNING.maxOffsetXPx || 2),
        maxOffsetYPx: Number(FAKE_DEPTH_TUNING.maxOffsetYPx || 2),
        nearDistanceForFullEffect: Number(
          FAKE_DEPTH_TUNING.nearDistanceForFullEffect || 120
        ),
        minEffectStrength: Number(FAKE_DEPTH_TUNING.minEffectStrength || 0),
        roofScale: Number(FAKE_DEPTH_TUNING.roofScale || 1.08),
        roofTextureAlpha: Number(FAKE_DEPTH_TUNING.roofTextureAlpha || 1),
        x: placement.x,
        y: placement.y,
      });
      this.buildings.push(building);
    }
  }

  destroyBuildings() {
    for (const building of this.buildings) {
      building.destroy();
    }
    this.buildings = [];
  }

  isCollisionZoneAt(x, y) {
    if (!this.map) return false;
    if (typeof this.map.isRoadAt === "function") {
      return !this.map.isRoadAt(x, y);
    }
    if (typeof this.map?.collision?.findNearestRoadPoint === "function") {
      return !this.map.collision.findNearestRoadPoint(x, y).insideRoad;
    }
    return false;
  }

  isRectFullyInCollisionZone(centerX, centerY, width, height) {
    const halfW = width * 0.5;
    const halfH = height * 0.5;
    const edgeRatio = Math.min(0.8, Math.max(0.58, 120 / Math.max(120, width, height)));
    const samples = [
      [0, 0],
      [-halfW * edgeRatio, -halfH * edgeRatio],
      [halfW * edgeRatio, -halfH * edgeRatio],
      [halfW * edgeRatio, halfH * edgeRatio],
      [-halfW * edgeRatio, halfH * edgeRatio],
      [0, -halfH * edgeRatio],
      [0, halfH * edgeRatio],
      [-halfW * edgeRatio, 0],
      [halfW * edgeRatio, 0],
    ];
    for (const [dx, dy] of samples) {
      if (!this.isCollisionZoneAt(centerX + dx, centerY + dy)) {
        return false;
      }
    }
    return true;
  }

  findNearbyCollisionPoint(baseX, baseY, width, height) {
    if (this.isRectFullyInCollisionZone(baseX, baseY, width, height)) {
      return { x: baseX, y: baseY };
    }

    const step = 90;
    const maxRadius = 1200;
    for (let radius = step; radius <= maxRadius; radius += step) {
      for (let angle = 0; angle < 360; angle += 20) {
        const rad = Phaser.Math.DegToRad(angle);
        const x = baseX + Math.cos(rad) * radius;
        const y = baseY + Math.sin(rad) * radius;
        if (this.isRectFullyInCollisionZone(x, y, width, height)) {
          return { x, y };
        }
      }
    }
    return null;
  }

  canPlaceWithoutOverlap(placements, x, y, preset) {
    const candidateRadius = Math.max(preset.width, preset.height) * 0.34;
    return !placements.some((entry) => {
      const otherPreset = entry.preset;
      if (!otherPreset) return false;
      const otherRadius =
        Math.max(otherPreset.width, otherPreset.height) * 0.34;
      return Math.hypot(entry.x - x, entry.y - y) < candidateRadius + otherRadius;
    });
  }

  buildScaledPreset(preset, scale) {
    const safeScale = Phaser.Math.Clamp(Number(scale || 1), 0.4, 1);
    return {
      ...preset,
      width: Math.max(MIN_BUILDING_WIDTH, Math.round(preset.width * safeScale)),
      height: Math.max(MIN_BUILDING_HEIGHT, Math.round(preset.height * safeScale)),
      fakeHeight: Math.max(
        MIN_BUILDING_FAKE_HEIGHT,
        Math.round(preset.fakeHeight * (0.86 + safeScale * 0.14))
      ),
    };
  }

  findNearbyCollisionPlacement(baseX, baseY, preset) {
    for (const scale of SCALE_STEPS) {
      const scaledPreset = this.buildScaledPreset(preset, scale);
      const near = this.findNearbyCollisionPoint(
        baseX,
        baseY,
        scaledPreset.width,
        scaledPreset.height
      );
      if (!near) continue;
      return {
        x: near.x,
        y: near.y,
        preset: scaledPreset,
      };
    }
    return null;
  }

  findCollisionPlacements() {
    const worldW = Number(this.map?.worldWidth || 0);
    const worldH = Number(this.map?.worldHeight || 0);
    if (worldW <= 0 || worldH <= 0) return [];

    const worldArea = worldW * worldH;
    const targetCount = Phaser.Math.Clamp(
      Math.round(worldArea / 1800000),
      24,
      96
    );
    const anchorTarget = Math.max(targetCount * 2, 36);
    const aspect = worldW / Math.max(1, worldH);
    const columns = Math.max(4, Math.round(Math.sqrt(anchorTarget * aspect)));
    const rows = Math.max(4, Math.ceil(anchorTarget / columns));
    const cellW = (worldW - WORLD_MARGIN * 2) / columns;
    const cellH = (worldH - WORLD_MARGIN * 2) / rows;
    const anchors = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const seed = row * 997 + col * 131 + targetCount * 17;
        const jitterX = (hash01(seed + 1) - 0.5) * cellW * 0.5;
        const jitterY = (hash01(seed + 2) - 0.5) * cellH * 0.5;
        const x = WORLD_MARGIN + (col + 0.5) * cellW + jitterX;
        const y = WORLD_MARGIN + (row + 0.5) * cellH + jitterY;
        anchors.push({
          x: Phaser.Math.Clamp(x, WORLD_MARGIN, worldW - WORLD_MARGIN),
          y: Phaser.Math.Clamp(y, WORLD_MARGIN, worldH - WORLD_MARGIN),
          seed,
        });
      }
    }

    const placements = [];
    for (let i = 0; i < anchors.length; i += 1) {
      const anchor = anchors[i];
      const tries = [0, 1, 2].map((offset) =>
        pickPresetBySeed(anchor.seed + i * 13 + offset * 97)
      );
      for (const preset of tries) {
        const placement = this.findNearbyCollisionPlacement(
          anchor.x,
          anchor.y,
          preset
        );
        if (!placement) continue;
        if (
          !this.canPlaceWithoutOverlap(
            placements,
            placement.x,
            placement.y,
            placement.preset
          )
        ) {
          continue;
        }
        placements.push(placement);
        break;
      }
      if (placements.length >= targetCount) break;
    }

    // Relleno final para no dejar huecos grandes cuando la malla cae sobre carretera.
    if (placements.length < targetCount) {
      const fillAttempts = targetCount * 10;
      for (
        let attempt = 0;
        attempt < fillAttempts && placements.length < targetCount;
        attempt += 1
      ) {
        const seed = 9173 + attempt * 37 + targetCount * 11;
        const anchor = {
          x: Phaser.Math.Clamp(
            WORLD_MARGIN + hash01(seed + 1) * (worldW - WORLD_MARGIN * 2),
            WORLD_MARGIN,
            worldW - WORLD_MARGIN
          ),
          y: Phaser.Math.Clamp(
            WORLD_MARGIN + hash01(seed + 2) * (worldH - WORLD_MARGIN * 2),
            WORLD_MARGIN,
            worldH - WORLD_MARGIN
          ),
        };
        const preset = pickPresetBySeed(seed + 3);
        const placement = this.findNearbyCollisionPlacement(
          anchor.x,
          anchor.y,
          preset
        );
        if (!placement) continue;
        if (
          !this.canPlaceWithoutOverlap(
            placements,
            placement.x,
            placement.y,
            placement.preset
          )
        ) {
          continue;
        }
        placements.push(placement);
      }
    }
    return placements;
  }

  destroy() {
    this.destroyBuildings();
    this.map = null;
    this.moto = null;
    this.toggleKey = null;
  }
}
