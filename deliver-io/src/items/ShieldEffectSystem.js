export default class ShieldEffectSystem {
  constructor(options = {}) {
    this.onStateChanged = options.onStateChanged || null;
    this.reset();
  }

  reset() {
    this.active = false;
    this.maxDurability = 0;
    this.durability = 0;
    this.emitStateChanged();
  }

  emitStateChanged() {
    this.onStateChanged?.(this.getState());
  }

  activate(maxMotoHealth) {
    const safeHealth = Math.max(1, Number(maxMotoHealth || 0));
    this.maxDurability = Math.max(1, Math.round(safeHealth * 0.5));
    this.durability = this.maxDurability;
    this.active = true;
    this.emitStateChanged();
    return true;
  }

  interceptMotoDamage(damage) {
    if (!this.active || this.durability <= 0) return Math.max(0, Number(damage || 0));

    const safeDamage = Math.max(0, Number(damage || 0));
    const absorbed = Math.min(this.durability, safeDamage);
    this.durability = Math.max(0, this.durability - absorbed);
    if (this.durability <= 0) {
      this.active = false;
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

  getState() {
    return {
      active: this.active,
      durability: this.durability,
      maxDurability: this.maxDurability,
      percent:
        this.maxDurability > 0
          ? Math.max(0, Math.min(1, this.durability / this.maxDurability))
          : 0,
    };
  }
}
