import { ITEM_CONFIG, ITEM_TYPES } from "./catalog.js";
import { circleIntersectsRotatedRect, getRotatedRectPoints } from "./geometry.js";

export default class OilSlickItem {
  constructor(payload = {}) {
    this.type = ITEM_TYPES.OIL;
    this.sync(payload);
  }

  sync(payload = {}) {
    this.id = payload.id || this.id || "";
    this.ownerId = payload.ownerId || this.ownerId || "";
    this.x = Number(payload.x) || 0;
    this.y = Number(payload.y) || 0;
    this.angle = Number(payload.angle) || 0;
    this.createdAt = Number(payload.createdAt) || this.createdAt || 0;
    this.triggeredAt = Number(payload.triggeredAt) || 0;
    this.removesAt = Number(payload.removesAt) || 0;
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

  containsCircle(x, y, radius) {
    return circleIntersectsRotatedRect(x, y, radius, this.getRect());
  }

  draw(graphics, shadowGraphics) {
    const config = ITEM_CONFIG[this.type];
    const rect = this.getRect();
    const points = getRotatedRectPoints(rect.x, rect.y, rect.width, rect.height, rect.angle);

    shadowGraphics.fillStyle(0x000000, config.draw.shadowAlpha);
    shadowGraphics.beginPath();
    shadowGraphics.moveTo(points[0].x + 8, points[0].y + 10);
    for (let index = 1; index < points.length; index += 1) {
      shadowGraphics.lineTo(points[index].x + 8, points[index].y + 10);
    }
    shadowGraphics.closePath();
    shadowGraphics.fillPath();

    graphics.fillStyle(config.draw.color, config.draw.alpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(3, config.draw.edgeColor, config.draw.edgeAlpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.closePath();
    graphics.strokePath();
  }
}
