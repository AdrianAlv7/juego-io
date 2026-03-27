import Phaser from "phaser";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nearestPointOnSegment(x, y, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby || 1;
  const t = clamp(((x - ax) * abx + (y - ay) * aby) / lenSq, 0, 1);

  return {
    x: ax + abx * t,
    y: ay + aby * t,
  };
}

export default class DeliveryRouteMap {
  constructor(scene, options = {}) {
    this.scene = scene;

    const { worldWidth = 6000, worldHeight = 6000 } = options;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.deliveryRadius = 170;
    this.completedTrips = 0;
    this.roadHalfWidth = 210;
    this.collisionHalfWidth = this.roadHalfWidth + 10;
    this.repositionHalfWidth = this.roadHalfWidth - 8;

    this.roadCurves = this.createRoadCurves();
    const geometry = this.buildRoadGeometry();
    this.roadSegments = geometry.segments;
    this.sampledRoutes = geometry.sampledRoutes;

    this.deliveryPoints = {
      A: { x: 900, y: 1400, color: 0xff9f1c },
      B: { x: 4700, y: 4900, color: 0x2ec4b6 },
    };
    this.currentTargetKey = "A";

    this.drawEnvironment();
    this.drawRoads();
    this.createDeliveryMarkers();

    this.spawnPoint = { x: 980, y: 1650 };
    this.collisionGroup = null;
  }

  createRoadCurves() {
    // Loop principal con rectas largas y curvas amplias.
    const mainLoop = [
      { x: 850, y: 1400 },
      { x: 1250, y: 950 },
      { x: 2300, y: 760 },
      { x: 3550, y: 840 },
      { x: 4700, y: 1200 },
      { x: 5300, y: 2000 },
      { x: 5450, y: 3000 },
      { x: 5250, y: 4100 },
      { x: 4700, y: 4900 },
      { x: 3600, y: 5300 },
      { x: 2300, y: 5350 },
      { x: 1300, y: 5000 },
      { x: 760, y: 4200 },
      { x: 620, y: 3000 },
      { x: 700, y: 2000 },
      { x: 850, y: 1400 },
    ];

    // Avenida diagonal para acelerar fuerte de punta a punta.
    const fastAvenue = [
      { x: 900, y: 3000 },
      { x: 1700, y: 2550 },
      { x: 2750, y: 2350 },
      { x: 3650, y: 2550 },
      { x: 4550, y: 3100 },
      { x: 5300, y: 3950 },
    ];

    // Circuito interno con curvas cerradas para drift.
    const driftPocket = [
      { x: 3100, y: 1650 },
      { x: 3550, y: 1300 },
      { x: 4150, y: 1320 },
      { x: 4650, y: 1700 },
      { x: 4860, y: 2250 },
      { x: 4630, y: 2720 },
      { x: 4110, y: 2920 },
      { x: 3550, y: 2700 },
      { x: 3270, y: 2250 },
      { x: 3340, y: 1850 },
      { x: 3100, y: 1650 },
    ];

    // Enlace en S para encadenar drifts entre el centro y zona baja.
    const sLink = [
      { x: 1700, y: 4300 },
      { x: 2100, y: 3780 },
      { x: 2550, y: 3350 },
      { x: 3050, y: 3050 },
      { x: 3600, y: 2920 },
      { x: 4100, y: 3040 },
      { x: 4450, y: 3500 },
      { x: 4500, y: 4200 },
    ];

    // Conectores para cerrar cruces entre todas las rutas.
    const northConnector = [
      { x: 2500, y: 1080 },
      { x: 2850, y: 1250 },
      { x: 3100, y: 1650 },
    ];
    const centerConnector = [
      { x: 3650, y: 2550 },
      { x: 3980, y: 2500 },
      { x: 4450, y: 2250 },
    ];
    const westConnector = [
      { x: 900, y: 3000 },
      { x: 980, y: 3620 },
      { x: 1380, y: 4350 },
      { x: 1700, y: 4300 },
    ];
    const eastConnector = [
      { x: 4500, y: 4200 },
      { x: 4580, y: 4620 },
      { x: 4700, y: 4900 },
    ];

    const routeSets = [
      mainLoop,
      fastAvenue,
      driftPocket,
      sLink,
      northConnector,
      centerConnector,
      westConnector,
      eastConnector,
    ];
    return routeSets.map((route) => {
      const points = route.map((p) => new Phaser.Math.Vector2(p.x, p.y));
      return new Phaser.Curves.Spline(points);
    });
  }

  buildRoadGeometry() {
    const segments = [];
    const sampledRoutes = [];

    for (const curve of this.roadCurves) {
      const points = curve.getSpacedPoints(220);
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

  drawEnvironment() {
    const bg = this.scene.add.rectangle(
      this.worldWidth / 2,
      this.worldHeight / 2,
      this.worldWidth,
      this.worldHeight,
      0x1f252b
    );
    bg.setDepth(-40);

    const city = this.scene.add.graphics();
    city.setDepth(-30);
    city.fillStyle(0x2c353f, 1);

    for (let y = 420; y <= this.worldHeight - 420; y += 560) {
      for (let x = 420; x <= this.worldWidth - 420; x += 560) {
        city.fillRoundedRect(x - 175, y - 175, 350, 350, 24);
      }
    }
  }

  drawRoads() {
    const roadGraphics = this.scene.add.graphics();
    roadGraphics.setDepth(-20);

    // Base ancha de carretera.
    roadGraphics.lineStyle(this.roadHalfWidth * 2 + 34, 0x3d4853, 1);
    for (const curve of this.roadCurves) {
      curve.draw(roadGraphics, 260);
    }

    // Capa central.
    roadGraphics.lineStyle(this.roadHalfWidth * 2, 0x536272, 1);
    for (const curve of this.roadCurves) {
      curve.draw(roadGraphics, 260);
    }

    // Bordes.
    roadGraphics.lineStyle(6, 0xecf0f3, 0.95);
    for (const curve of this.roadCurves) {
      curve.draw(roadGraphics, 260);
    }

    // Guias centrales intermitentes.
    roadGraphics.lineStyle(4, 0xf6dd7c, 0.85);
    this.drawDashedCenterLines(roadGraphics);
  }

  drawDashedCenterLines(graphics) {
    const dashLength = 90;
    const gapLength = 70;

    for (const route of this.sampledRoutes) {
      for (let i = 0; i < route.length - 1; i += 1) {
        const a = route[i];
        const b = route[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;

        const ux = dx / length;
        const uy = dy / length;
        let cursor = 0;
        let drawDash = true;

        while (cursor < length) {
          const step = Math.min(
            drawDash ? dashLength : gapLength,
            length - cursor
          );
          if (drawDash) {
            const x1 = a.x + ux * cursor;
            const y1 = a.y + uy * cursor;
            const x2 = a.x + ux * (cursor + step);
            const y2 = a.y + uy * (cursor + step);
            graphics.lineBetween(x1, y1, x2, y2);
          }
          cursor += step;
          drawDash = !drawDash;
        }
      }
    }
  }

  createDeliveryMarkers() {
    this.markerNodes = {};

    for (const [key, point] of Object.entries(this.deliveryPoints)) {
      const zone = this.scene.add.circle(
        point.x,
        point.y,
        this.deliveryRadius,
        point.color,
        0.18
      );
      zone.setStrokeStyle(5, point.color, 0.9);
      zone.setDepth(-5);

      const label = this.scene.add.text(point.x, point.y, key, {
        fontFamily: "Consolas, monospace",
        fontSize: "44px",
        color: "#ffffff",
        fontStyle: "bold",
      });
      label.setOrigin(0.5);
      label.setDepth(10);

      this.markerNodes[key] = { zone, label };
    }

    this.updateTargetVisuals();
  }

  updateTargetVisuals() {
    for (const [key, marker] of Object.entries(this.markerNodes)) {
      const isActive = key === this.currentTargetKey;
      marker.zone.setAlpha(isActive ? 0.35 : 0.12);
      marker.zone.setStrokeStyle(5, marker.zone.fillColor, isActive ? 1 : 0.55);
      marker.label.setScale(isActive ? 1 : 0.86);
      marker.label.setAlpha(isActive ? 1 : 0.5);
    }
  }

  getSpawnPoint() {
    return this.spawnPoint;
  }

  getCollisionGroup() {
    return this.collisionGroup;
  }

  getHudInfo() {
    return {
      objective: `Objetivo: ir a ${this.currentTargetKey} | Entregas: ${this.completedTrips}`,
    };
  }

  findNearestRoadPoint(x, y) {
    let insideRoad = false;
    let nearest = { x, y };
    let tangent = { x: 1, y: 0 };
    let bestDistSq = Number.POSITIVE_INFINITY;
    const limitSq = this.collisionHalfWidth * this.collisionHalfWidth;

    for (const segment of this.roadSegments) {
      const point = nearestPointOnSegment(
        x,
        y,
        segment.ax,
        segment.ay,
        segment.bx,
        segment.by
      );
      const dx = x - point.x;
      const dy = y - point.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= limitSq) {
        insideRoad = true;
      }

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        nearest = point;
        const segX = segment.bx - segment.ax;
        const segY = segment.by - segment.ay;
        const segLen = Math.hypot(segX, segY) || 1;
        tangent = { x: segX / segLen, y: segY / segLen };
      }
    }

    return { insideRoad, nearest, tangent, distanceSq: bestDistSq };
  }

  updateDeliveryProgress(moto) {
    const target = this.deliveryPoints[this.currentTargetKey];
    const distance = Phaser.Math.Distance.Between(
      moto.sprite.x,
      moto.sprite.y,
      target.x,
      target.y
    );

    if (distance > this.deliveryRadius * 0.55) return;

    this.completedTrips += 1;
    this.currentTargetKey = this.currentTargetKey === "A" ? "B" : "A";
    this.updateTargetVisuals();
  }

  enforcePlayer(moto) {
    this.updateDeliveryProgress(moto);

    const closest = this.findNearestRoadPoint(moto.sprite.x, moto.sprite.y);
    if (closest.insideRoad) return;

    const previousX = moto.sprite.x;
    const previousY = moto.sprite.y;
    const distance = Math.sqrt(closest.distanceSq);

    let nx;
    let ny;
    if (distance > 0.001) {
      nx = (previousX - closest.nearest.x) / distance;
      ny = (previousY - closest.nearest.y) / distance;
    } else {
      // Fallback estable si cae exactamente sobre la linea central.
      nx = -closest.tangent.y;
      ny = closest.tangent.x;
    }

    const targetX = closest.nearest.x + nx * this.repositionHalfWidth;
    const targetY = closest.nearest.y + ny * this.repositionHalfWidth;
    const penetration = Math.max(0, distance - this.collisionHalfWidth);
    const correctionLerp = Phaser.Math.Clamp(
      0.14 + penetration / 200,
      0.14,
      0.46
    );
    const correctedX = Phaser.Math.Linear(previousX, targetX, correctionLerp);
    const correctedY = Phaser.Math.Linear(previousY, targetY, correctionLerp);
    moto.sprite.setPosition(correctedX, correctedY);
    moto.sprite.body.updateFromGameObject();

    const normalSpeed = moto.velX * nx + moto.velY * ny;
    if (normalSpeed > 0) {
      const cancelFactor = Phaser.Math.Clamp(
        0.58 + penetration / 160,
        0.58,
        0.9
      );
      moto.velX -= normalSpeed * nx * cancelFactor;
      moto.velY -= normalSpeed * ny * cancelFactor;
    }

    // Castigo suave: mantiene movimiento para poder girar y salir del borde.
    const impactDrag = Phaser.Math.Clamp(
      0.02 + penetration / 700,
      0.02,
      0.12
    );
    const dragFactor = 1 - impactDrag;
    moto.velX *= dragFactor;
    moto.velY *= dragFactor;
    moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);
  }
}
