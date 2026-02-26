import Phaser from "phaser";
import { CITY_RACE_LAYOUT, CITY_RACE_TUNING } from "./config/cityRaceLayout.js";
import CityRaceRenderer from "./systems/CityRaceRenderer.js";
import CountdownSystem from "./systems/CountdownSystem.js";
import ObjectiveSystem from "./systems/ObjectiveSystem.js";
import RouteGuideSystem from "./systems/RouteGuideSystem.js";
import RoadCollisionSystem from "./systems/RoadCollisionSystem.js";
import PlayerHealthSystem from "./systems/PlayerHealthSystem.js";

export default class CityRaceMap {
  constructor(scene, options = {}) {
    this.scene = scene;

    const { worldWidth = 6000, worldHeight = 6000 } = options;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.spawnPoint = { ...CITY_RACE_LAYOUT.spawnPoint };
    this.basePoint = { ...this.spawnPoint };
    this.collisionGroup = null;

    this.roadCurves = this.createRoadCurves();
    const { segments, sampledRoutes } = this.buildRoadGeometry();

    this.renderer = new CityRaceRenderer(scene, {
      worldWidth,
      worldHeight,
      roadHalfWidth: CITY_RACE_TUNING.roadHalfWidth,
      roadCurves: this.roadCurves,
      sampledRoutes,
      drawSamples: CITY_RACE_TUNING.roadDrawSamples,
    });
    this.renderer.render();

    this.countdown = new CountdownSystem(scene, {
      preStartMs: CITY_RACE_TUNING.preStartMs,
      goVisibleMs: CITY_RACE_TUNING.goVisibleMs,
    });

    this.objectives = new ObjectiveSystem(scene, {
      basePoint: this.basePoint,
      orders: CITY_RACE_LAYOUT.orders,
      radii: {
        pickupRadius: CITY_RACE_TUNING.pickupRadius,
        dropoffRadius: CITY_RACE_TUNING.dropoffRadius,
        returnRadius: CITY_RACE_TUNING.returnRadius,
      },
      serviceTimeMs: CITY_RACE_TUNING.serviceTimeMs,
      defaultEventDurationMs: CITY_RACE_TUNING.defaultEventDurationMs,
    });

    this.guide = new RouteGuideSystem(scene);

    this.collision = new RoadCollisionSystem({
      segments,
      collisionHalfWidth: CITY_RACE_TUNING.collisionHalfWidth,
      repositionHalfWidth: CITY_RACE_TUNING.repositionHalfWidth,
      gridCellSize: CITY_RACE_TUNING.roadGridCellSize,
      gridRadius: CITY_RACE_TUNING.roadGridRadius,
    });

    this.health = new PlayerHealthSystem({
      maxHealth: CITY_RACE_TUNING.maxHealth,
      minImpactForDamage: CITY_RACE_TUNING.minImpactForDamage,
      collisionDamageFactor: CITY_RACE_TUNING.collisionDamageFactor,
    });
    this.lastHasPackage = false;
  }

  createRoadCurves() {
    return CITY_RACE_LAYOUT.routeSets.map((route) => {
      const points = route.map((p) => new Phaser.Math.Vector2(p.x, p.y));
      return new Phaser.Curves.Spline(points);
    });
  }

  buildRoadGeometry() {
    const segments = [];
    const sampledRoutes = [];
    const samples = CITY_RACE_TUNING.roadGeometrySamples;

    for (const curve of this.roadCurves) {
      const points = curve.getSpacedPoints(samples);
      sampledRoutes.push(points);

      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        segments.push({
          ax: a.x,
          ay: a.y,
          bx: b.x,
          by: b.y,
        });
      }
    }

    return { segments, sampledRoutes };
  }

  isPlayerLocked() {
    this.countdown.update();
    return this.countdown.isLocked() || this.objectives.isFinished();
  }

  enforcePlayer(moto) {
    this.countdown.update();
    const locked = this.countdown.isLocked();

    this.objectives.update(moto, locked);
    this.guide.update(
      moto,
      this.objectives.getCurrentObjective(),
      this.objectives.isFinished()
    );

    const riderState = this.objectives.getRiderState();
    if (riderState.hasPackage && !this.lastHasPackage) {
      this.health.startPackage();
    } else if (!riderState.hasPackage && this.lastHasPackage) {
      this.health.clearPackage();
    }
    this.lastHasPackage = riderState.hasPackage;

    const collisionInfo = this.collision.enforce(moto);
    this.health.applyCollision(collisionInfo);
  }

  getHudInfo(moto) {
    const locked = this.countdown.isLocked();
    return {
      objective: this.objectives.getObjectiveText(locked, this.countdown.getLabel()),
      nextStop: this.objectives.getNextStopText(moto),
      cargo: this.objectives.getCargoHudText(),
      health: this.health.getHudText(),
      mapHint: "1: Abierto | 2: Pista | 3: Reparto | 4: Carrera | R: Reiniciar",
    };
  }

  getSpawnPoint() {
    return this.spawnPoint;
  }

  getCollisionGroup() {
    return this.collisionGroup;
  }
}
