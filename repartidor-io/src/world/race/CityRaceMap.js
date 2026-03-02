import Phaser from "phaser";
import { CITY_RACE_LAYOUT, CITY_RACE_TUNING } from "./config/cityRaceLayout.js";
import CityRaceRenderer from "./systems/CityRaceRenderer.js";
import CountdownSystem from "./systems/CountdownSystem.js";
import ObjectiveSystem from "./systems/ObjectiveSystem.js";
import RouteGuideSystem from "./systems/RouteGuideSystem.js";
import RoadCollisionSystem from "./systems/RoadCollisionSystem.js";
import PlayerHealthSystem from "./systems/PlayerHealthSystem.js";
import MotoHealthSystem from "./systems/MotoHealthSystem.js";
import { formatKm } from "./utils/telemetry.js";

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
      collisionCooldownMs: CITY_RACE_TUNING.collisionDamageCooldownMs,
      totalOrders: CITY_RACE_LAYOUT.orders.length,
    });
    this.motoHealth = new MotoHealthSystem({
      maxHealth: CITY_RACE_TUNING.motoMaxHealth,
      minImpactForDamage: CITY_RACE_TUNING.motoMinImpactForDamage,
      collisionDamageFactor: CITY_RACE_TUNING.motoCollisionDamageFactor,
      collisionCooldownMs: CITY_RACE_TUNING.collisionDamageCooldownMs,
      repairDurationMs: CITY_RACE_TUNING.motoRepairDurationMs,
    });
    this.lastHasPackage = false;
    this.raceStartedAtMs = null;
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
    const nowMs = this.scene.time.now;
    const repairing = this.motoHealth.isRepairing(nowMs);
    if (!locked && !repairing && this.raceStartedAtMs === null) {
      this.raceStartedAtMs = this.scene.time.now;
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

    const collisionInfo = this.collision.enforce(moto);
    this.health.applyCollision(collisionInfo, nowMs);
    this.motoHealth.applyCollision(collisionInfo, nowMs);
    this.motoHealth.update(nowMs, moto);
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

  getElapsedRaceTimeMs() {
    if (this.raceStartedAtMs === null) return 0;
    const nowMs = this.scene.time.now;
    const finishMs = this.objectives.finishTimeMs || nowMs;
    const endMs = this.objectives.isFinished() ? finishMs : nowMs;
    return Math.max(0, endMs - this.raceStartedAtMs);
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
    return this.spawnPoint;
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
