import Phaser from "phaser";
import { speedPxPerSecToKmh } from "../utils/telemetry.js";

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

export default class RoadCollisionSystem {
  constructor(options) {
    this.segments = options.segments;
    this.collisionHalfWidth = options.collisionHalfWidth;
    this.repositionHalfWidth = options.repositionHalfWidth;
    this.gridCellSize = options.gridCellSize;
    this.gridRadius = options.gridRadius;
    // Evita alternar entre "colision/no colision" cerca del borde.
    this.contactReleaseInset = Math.max(
      6,
      Number(options.contactReleaseInset || 16)
    );
    // Mantiene al jugador apenas dentro de carretera para salir suave.
    this.reentryInset = Math.max(2, Number(options.reentryInset || 8));
    this.grid = this.buildGrid(this.segments);
    this.allSegmentIndexes = this.segments.map((_segment, index) => index);
    this.contactStateByMoto = new WeakMap();
  }

  buildGrid(segments) {
    const grid = new Map();
    const pad = this.collisionHalfWidth;
    const cellSize = this.gridCellSize;

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const minX = Math.min(segment.ax, segment.bx) - pad;
      const maxX = Math.max(segment.ax, segment.bx) + pad;
      const minY = Math.min(segment.ay, segment.by) - pad;
      const maxY = Math.max(segment.ay, segment.by) + pad;

      const startCellX = Math.floor(minX / cellSize);
      const endCellX = Math.floor(maxX / cellSize);
      const startCellY = Math.floor(minY / cellSize);
      const endCellY = Math.floor(maxY / cellSize);

      for (let cy = startCellY; cy <= endCellY; cy += 1) {
        for (let cx = startCellX; cx <= endCellX; cx += 1) {
          const key = `${cx}:${cy}`;
          const bucket = grid.get(key);
          if (bucket) {
            bucket.push(i);
          } else {
            grid.set(key, [i]);
          }
        }
      }
    }

    return grid;
  }

  getCandidateIndexes(x, y) {
    const cellSize = this.gridCellSize;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    const uniqueIndexes = new Set();

    for (let yOffset = -this.gridRadius; yOffset <= this.gridRadius; yOffset += 1) {
      for (let xOffset = -this.gridRadius; xOffset <= this.gridRadius; xOffset += 1) {
        const key = `${cellX + xOffset}:${cellY + yOffset}`;
        const indexes = this.grid.get(key);
        if (!indexes) continue;
        for (const index of indexes) {
          uniqueIndexes.add(index);
        }
      }
    }

    return uniqueIndexes.size > 0 ? uniqueIndexes : this.allSegmentIndexes;
  }

  findNearestRoadPoint(x, y) {
    let bestDistSq = Number.POSITIVE_INFINITY;
    let nearest = { x, y };
    let tangent = { x: 1, y: 0 };
    let insideRoad = false;
    const collisionLimitSq = this.collisionHalfWidth * this.collisionHalfWidth;

    const candidates = this.getCandidateIndexes(x, y);
    for (const index of candidates) {
      const segment = this.segments[index];
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

      if (distSq <= collisionLimitSq) {
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

    return {
      insideRoad,
      nearest,
      tangent,
      distanceSq: bestDistSq,
    };
  }

  enforce(moto) {
    const speedKmh = speedPxPerSecToKmh(moto.speedPxPerSec);
    const contactState = this.contactStateByMoto.get(moto) || {
      colliding: false,
    };
    this.contactStateByMoto.set(moto, contactState);

    const closest = this.findNearestRoadPoint(moto.sprite.x, moto.sprite.y);
    const distance = Math.sqrt(closest.distanceSq);
    if (closest.insideRoad) {
      const releaseDistance = this.collisionHalfWidth - this.contactReleaseInset;
      if (distance <= releaseDistance) {
        contactState.colliding = false;
      }
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

    const nowMs = Number(moto?.scene?.time?.now || Date.now());
    if (moto?.shouldBypassCollision?.(nowMs)) {
      return {
        collided: false,
        justCollided: false,
        damageEvent: false,
        impact: 0,
        penetration: 0,
        speedKmh,
        ghostBypassed: true,
      };
    }

    const previousX = moto.sprite.x;
    const previousY = moto.sprite.y;
    let nx;
    let ny;
    if (distance > 0.001) {
      nx = (previousX - closest.nearest.x) / distance;
      ny = (previousY - closest.nearest.y) / distance;
    } else {
      nx = -closest.tangent.y;
      ny = closest.tangent.x;
    }

    const preferredHalfWidth = Math.max(
      this.repositionHalfWidth,
      this.collisionHalfWidth - this.reentryInset
    );
    const clampedHalfWidth = Phaser.Math.Clamp(
      preferredHalfWidth,
      0,
      this.collisionHalfWidth - 1
    );
    const targetX = closest.nearest.x + nx * clampedHalfWidth;
    const targetY = closest.nearest.y + ny * clampedHalfWidth;
    const penetration = Math.max(0, distance - this.collisionHalfWidth);
    const justCollided = !contactState.colliding;
    contactState.colliding = true;
    const correctionLerp = justCollided
      ? Phaser.Math.Clamp(0.45 + penetration / 260, 0.45, 0.7)
      : Phaser.Math.Clamp(0.35 + penetration / 320, 0.35, 0.62);
    const correctedX = Phaser.Math.Linear(previousX, targetX, correctionLerp);
    const correctedY = Phaser.Math.Linear(previousY, targetY, correctionLerp);

    moto.sprite.setPosition(correctedX, correctedY);
    moto.sprite.body.updateFromGameObject();

    const normalSpeed = moto.velX * nx + moto.velY * ny;
    const speedIntoWall = Math.max(0, normalSpeed);
    if (normalSpeed > 0) {
      // Cancela por completo el componente de velocidad contra el muro.
      moto.velX -= normalSpeed * nx;
      moto.velY -= normalSpeed * ny;
    }

    // En el primer impacto corta toda inercia para que el choque sea "seco".
    // En contacto sostenido, deja algo de movimiento tangencial para salir girando.
    let tangentSpeed = moto.velX * closest.tangent.x + moto.velY * closest.tangent.y;
    if (justCollided) {
      tangentSpeed = 0;
    } else {
      tangentSpeed *= 0.72;
    }
    moto.velX = closest.tangent.x * tangentSpeed;
    moto.velY = closest.tangent.y * tangentSpeed;
    moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);

    return {
      collided: true,
      justCollided,
      damageEvent: justCollided,
      impact: speedIntoWall + penetration * 0.03,
      penetration,
      speedKmh,
      ghostBypassed: false,
    };
  }
}
