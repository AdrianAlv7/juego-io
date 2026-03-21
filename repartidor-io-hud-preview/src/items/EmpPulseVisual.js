export default class EmpPulseVisual {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = Number(options.depth || 28);
    this.graphics = scene.add.graphics().setDepth(this.depth);
    this.bursts = [];
  }

  trigger(payload = {}) {
    if (!payload?.x && payload?.x !== 0) return;
    this.bursts.push({
      x: Number(payload.x) || 0,
      y: Number(payload.y) || 0,
      radius: Math.max(80, Number(payload.radius || 520)),
      startedAt: this.scene.time.now,
      durationMs: Math.max(160, Number(payload.pulseVisualDurationMs || 560)),
      color: Number(payload.color || 0x6cc6ff),
      ringColor: Number(payload.ringColor || 0xffffff),
    });
  }

  update() {
    this.graphics.clear();
    const now = this.scene.time.now;
    this.bursts = this.bursts.filter((burst) => {
      const elapsed = now - burst.startedAt;
      if (elapsed >= burst.durationMs) return false;

      const progress = Math.max(0, Math.min(1, elapsed / burst.durationMs));
      const radius = burst.radius * progress;
      const alpha = 1 - progress;

      this.graphics.lineStyle(14 - progress * 6, burst.color, 0.5 * alpha);
      this.graphics.strokeCircle(burst.x, burst.y, radius);
      this.graphics.lineStyle(4, burst.ringColor, 0.7 * alpha);
      this.graphics.strokeCircle(burst.x, burst.y, radius * 0.72);
      this.graphics.fillStyle(burst.color, 0.09 * alpha);
      this.graphics.fillCircle(burst.x, burst.y, radius * 0.35);
      return true;
    });
  }

  destroy() {
    this.graphics.destroy();
  }
}
