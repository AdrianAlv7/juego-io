import { ITEM_CONFIG, ITEM_TYPES } from "./catalog.js";
import { getRotatedRectPoints, resolveCircleRectCollision } from "./geometry.js";

export default class WallBarrierItem {
  constructor(payload = {}) {
    this.type = ITEM_TYPES.WALL;
    this.sync(payload);
  }

  sync(payload = {}) {
    this.id = payload.id || this.id || "";
    this.ownerId = payload.ownerId || this.ownerId || "";
    this.x = Number(payload.x) || 0;
    this.y = Number(payload.y) || 0;
    this.angle = Number(payload.angle) || 0;
    this.createdAt = Number(payload.createdAt) || this.createdAt || 0;
  }

  getRect() {
    const config = ITEM_CONFIG[this.type];
    return {
      x: this.x,
      y: this.y,
      angle: this.angle,
      width: config.width,
      height: config.height,
    };
  }

  resolveCircleCollision(x, y, radius) {
    return resolveCircleRectCollision(x, y, radius, this.getRect());
  }

  draw(graphics, shadowGraphics) {
    const config = ITEM_CONFIG[this.type];
    const rect = this.getRect();
    const points = getRotatedRectPoints(rect.x, rect.y, rect.width, rect.height, rect.angle);

    shadowGraphics.fillStyle(0x000000, config.draw.shadowAlpha);
    shadowGraphics.beginPath();
    shadowGraphics.moveTo(points[0].x + 10, points[0].y + 12);
    for (let index = 1; index < points.length; index += 1) {
      shadowGraphics.lineTo(points[index].x + 10, points[index].y + 12);
    }
    shadowGraphics.closePath();
    shadowGraphics.fillPath();

    graphics.fillStyle(config.draw.color, 1);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(4, config.draw.edgeColor, 0.65);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.closePath();
    graphics.strokePath();

    const stripePoints = getRotatedRectPoints(
      rect.x,
      rect.y,
      rect.width * 0.92,
      rect.height * 0.26,
      rect.angle
    );
    graphics.fillStyle(config.draw.stripeColor, 0.9);
    graphics.beginPath();
    graphics.moveTo(stripePoints[0].x, stripePoints[0].y);
    for (let index = 1; index < stripePoints.length; index += 1) {
      graphics.lineTo(stripePoints[index].x, stripePoints[index].y);
    }
    graphics.closePath();
    graphics.fillPath();
  }
}
