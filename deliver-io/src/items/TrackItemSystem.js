import { ITEM_COLLISION_REPORT_COOLDOWN_MS, ITEM_CONFIG, ITEM_TYPES } from "./catalog.js";
import OilSlickItem from "./OilSlickItem.js";
import WallBarrierItem from "./WallBarrierItem.js";

export default class TrackItemSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.localPlayerId = options.localPlayerId || "";
    this.onTrigger = options.onTrigger || null;

    this.items = new Map();
    this.reportedAtById = new Map();
    this.oilAppliedById = new Set();
    this.wallConsumedById = new Set();

    this.shadowGraphics = scene.add.graphics().setDepth(-11);
    this.graphics = scene.add.graphics().setDepth(-10);
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id || "";
  }

  clear() {
    this.items.clear();
    this.reportedAtById.clear();
    this.oilAppliedById.clear();
    this.wallConsumedById.clear();
    this.shadowGraphics.clear();
    this.graphics.clear();
  }

  destroy() {
    this.clear();
    this.shadowGraphics.destroy();
    this.graphics.destroy();
  }

  createItem(payload = {}) {
    if (payload.type === ITEM_TYPES.OIL) return new OilSlickItem(payload);
    if (payload.type === ITEM_TYPES.WALL) return new WallBarrierItem(payload);
    return null;
  }

  setItems(items = []) {
    this.clear();
    items.forEach((payload) => this.upsertItem(payload, false));
    this.render();
  }

  upsertItem(payload = {}, shouldRender = true) {
    if (!payload?.id || !payload?.type) return;

    const current = this.items.get(payload.id);
    if (current) {
      current.sync(payload);
    } else {
      const next = this.createItem(payload);
      if (!next) return;
      this.items.set(payload.id, next);
    }

    if (shouldRender) {
      this.render();
    }
  }

  removeItem(id, shouldRender = true) {
    if (!id) return;
    this.items.delete(id);
    this.reportedAtById.delete(id);
    this.oilAppliedById.delete(id);
    this.wallConsumedById.delete(id);
    if (shouldRender) {
      this.render();
    }
  }

  render() {
    this.shadowGraphics.clear();
    this.graphics.clear();

    for (const item of this.items.values()) {
      item.draw(this.graphics, this.shadowGraphics);
    }
  }

  getMotoRadius(moto) {
    return Math.max(
      18,
      Math.round(
        Math.min(moto?.sprite?.displayWidth || 0, moto?.sprite?.displayHeight || 0) * 0.2
      )
    );
  }

  maybeReportTrigger(item, nowMs) {
    if (!item?.id || !this.onTrigger) return;
    const lastReportedAt = this.reportedAtById.get(item.id) || 0;
    if (nowMs - lastReportedAt < ITEM_COLLISION_REPORT_COOLDOWN_MS) return;
    this.reportedAtById.set(item.id, nowMs);
    this.onTrigger({
      id: item.id,
      type: item.type,
    });
  }

  handleLocalMoto(moto, nowMs) {
    const radius = this.getMotoRadius(moto);
    const x = moto.sprite.x;
    const y = moto.sprite.y;
    let wallResult = null;

    for (const item of this.items.values()) {
      if (!item || item.ownerId === this.localPlayerId) continue;

      if (item.type === ITEM_TYPES.OIL) {
        if (!item.containsCircle(x, y, radius)) continue;

        if (!this.oilAppliedById.has(item.id)) {
          this.oilAppliedById.add(item.id);
          moto.applyTrackItemEffect?.({
            id: item.id,
            type: ITEM_TYPES.OIL,
            durationMs: ITEM_CONFIG[ITEM_TYPES.OIL].effectDurationMs,
            brakeLocked: ITEM_CONFIG[ITEM_TYPES.OIL].brakeLocked,
            clearOnCollision: ITEM_CONFIG[ITEM_TYPES.OIL].clearsOnCollision,
            handling: ITEM_CONFIG[ITEM_TYPES.OIL].handling,
          });
          moto.velX *= 0.5;
          moto.velY *= 0.5;
          moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);
        }

        if (!item.triggeredAt) {
          this.maybeReportTrigger(item, nowMs);
        }
        continue;
      }

      if (item.type === ITEM_TYPES.WALL) {
        if (this.wallConsumedById.has(item.id)) continue;

        const collision = item.resolveCircleCollision(x, y, radius);
        if (!collision) continue;
        if (moto?.shouldBypassCollision?.(nowMs)) {
          return {
            ghostBypassed: true,
          };
        }

        this.wallConsumedById.add(item.id);
        this.maybeReportTrigger(item, nowMs);
        moto.flashItemImpactVisual?.(ITEM_TYPES.WALL);

        moto.sprite.x += collision.normalX * (collision.penetration + 8);
        moto.sprite.y += collision.normalY * (collision.penetration + 8);
        moto.sprite.body.updateFromGameObject();
        moto.velX *= -0.08;
        moto.velY *= -0.08;
        moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);

        wallResult = {
          collisionInfo: {
            collided: true,
            justCollided: true,
            damageEvent: false,
            impact: 1.35,
            penetration: collision.penetration,
            speedKmh: 0,
            ghostBypassed: false,
          },
          wallDamagePercent: ITEM_CONFIG[ITEM_TYPES.WALL].damagePercent,
          ghostBypassed: false,
        };
        break;
      }
    }

    return wallResult;
  }
}
