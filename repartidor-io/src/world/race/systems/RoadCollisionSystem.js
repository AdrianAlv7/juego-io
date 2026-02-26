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

export default class RoadCollisionSystem {
  constructor(options) {
    this.segments = options.segments;
    this.collisionHalfWidth = options.collisionHalfWidth;
    this.repositionHalfWidth = options.repositionHalfWidth;
    this.gridCellSize = options.gridCellSize;
    this.gridRadius = options.gridRadius;
    this.grid = this.buildGrid(this.segments);
    this.allSegmentIndexes = this.segments.map((_segment, index) => index);
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
    const closest = this.findNearestRoadPoint(moto.sprite.x, moto.sprite.y);
    if (closest.insideRoad) {
      return {
        collided: false,
        impact: 0,
        penetration: 0,
      };
    }

    const previousX = moto.sprite.x;
    const previousY = moto.sprite.y;
    const distance = Math.sqrt(closest.distanceSq);

    let nx;
    let ny;
    if (distance > 0.001) {
      nx = (previousX - closest.nearest.x) / distance;
      ny = (previousY - closest.nearest.y) / distance;
    } else {
      nx = -closest.tangent.y;
      ny = closest.tangent.x;
    }

    const targetX = closest.nearest.x + nx * this.repositionHalfWidth;
    const targetY = closest.nearest.y + ny * this.repositionHalfWidth;
    const penetration = Math.max(0, distance - this.collisionHalfWidth);
    const correctionLerp = Phaser.Math.Clamp(0.2 + penetration / 220, 0.2, 0.55);
    const correctedX = Phaser.Math.Linear(previousX, targetX, correctionLerp);
    const correctedY = Phaser.Math.Linear(previousY, targetY, correctionLerp);

    moto.sprite.setPosition(correctedX, correctedY);
    moto.sprite.body.updateFromGameObject();

    const normalSpeed = moto.velX * nx + moto.velY * ny;
    const speedIntoWall = Math.max(0, normalSpeed);
    if (normalSpeed > 0) {
      const cancelFactor = Phaser.Math.Clamp(0.58 + penetration / 180, 0.58, 0.9);
      moto.velX -= normalSpeed * nx * cancelFactor;
      moto.velY -= normalSpeed * ny * cancelFactor;
    }

    const dragFactor =
      1 - Phaser.Math.Clamp(0.02 + penetration / 780, 0.02, 0.12);
    moto.velX *= dragFactor;
    moto.velY *= dragFactor;
    moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);

    return {
      collided: true,
      impact: speedIntoWall + penetration * 0.03,
      penetration,
    };
  }
}
