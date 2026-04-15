export default class ShieldEffectSystem {
  constructor(options = {}) {
    this.onStateChanged = options.onStateChanged || null;
    this.durationMs = Math.max(1000, Number(options.durationMs || 15000));
    this.reset();
  }

  resolveNowMs(nowMs = Date.now()) {
    const parsed = Number(nowMs);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  reset() {
    this.active = false;
    this.maxDurability = 0;
    this.durability = 0;
    this.untilMs = 0;
    this.emitStateChanged();
  }

  emitStateChanged() {
    this.onStateChanged?.(this.getState());
  }

  activate(maxMotoHealth, nowMs = Date.now()) {
    const safeHealth = Math.max(1, Number(maxMotoHealth || 0));
    const safeNowMs = this.resolveNowMs(nowMs);
    this.maxDurability = Math.max(1, Math.round(safeHealth * 0.5));
    this.durability = this.maxDurability;
    this.active = true;
    this.untilMs = safeNowMs + this.durationMs;
    this.emitStateChanged();
    return true;
  }

  update(nowMs = Date.now()) {
    if (!this.active) return false;
    const safeNowMs = this.resolveNowMs(nowMs);
    if (this.untilMs > 0 && safeNowMs >= this.untilMs) {
      this.active = false;
      this.durability = 0;
      this.untilMs = 0;
      this.emitStateChanged();
      return true;
    }
    return false;
  }

  interceptMotoDamage(damage) {
    if (!this.active || this.durability <= 0) return Math.max(0, Number(damage || 0));

    const safeDamage = Math.max(0, Number(damage || 0));
    const absorbed = Math.min(this.durability, safeDamage);
    this.durability = Math.max(0, this.durability - absorbed);
    if (this.durability <= 0) {
      this.active = false;
      this.untilMs = 0;
    }
    this.emitStateChanged();
    return Math.max(0, safeDamage - absorbed);
  }

  interceptPackageDamage(damage) {
    if (this.active && this.durability > 0) {
      return 0;
    }
    return Math.max(0, Number(damage || 0));
  }

  getState(nowMs = Date.now()) {
    const safeNowMs = this.resolveNowMs(nowMs);
    return {
      active: this.active,
      durability: this.durability,
      maxDurability: this.maxDurability,
      percent:
        this.maxDurability > 0
          ? Math.max(0, Math.min(1, this.durability / this.maxDurability))
          : 0,
      remainingMs:
        this.active && this.untilMs > 0 ? Math.max(0, this.untilMs - safeNowMs) : 0,
    };
  }
}
