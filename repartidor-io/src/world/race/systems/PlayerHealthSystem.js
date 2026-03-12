export default class PlayerHealthSystem {
  constructor(options) {
    this.maxHealth = options.maxHealth;
    this.minImpactForDamage = options.minImpactForDamage;
    this.collisionDamageFactor = options.collisionDamageFactor;
    this.collisionCooldownMs = Math.max(
      80,
      Number(options.collisionCooldownMs || 180)
    );
    this.totalOrders = Math.max(1, Number(options.totalOrders || 1));
    this.damageInterceptor =
      typeof options.damageInterceptor === "function"
        ? options.damageInterceptor
        : null;
    this.health = this.maxHealth;
    this.packageActive = false;
    this.lastImpact = 0;
    this.lastDamageAtMs = -Infinity;
    this.deliveredCount = 0;
    this.deliveredQualityRatioSum = 0;
  }

  startPackage() {
    this.packageActive = true;
    this.health = this.maxHealth;
    this.lastImpact = 0;
  }

  clearPackage() {
    this.packageActive = false;
    this.lastImpact = 0;
  }

  computeDamageBySpeed(collisionInfo) {
    const speedKmh = Number(collisionInfo?.speedKmh || 0);
    const impact = Number(collisionInfo?.impact || 0);

    const speedNorm = Math.min(1, Math.max(0, (speedKmh - 20) / 150));
    const minPercent = 1 + speedNorm * 9;
    const maxPercent = 3 + speedNorm * 12;
    const randomPercent = minPercent + Math.random() * (maxPercent - minPercent);
    const impactScale = Math.min(1, Math.max(0.55, impact / 6));
    const damagePercent =
      randomPercent * impactScale * this.collisionDamageFactor * 7.2;
    return (this.maxHealth * damagePercent) / 100;
  }

  resolveDamage(damage, context = {}) {
    const safeDamage = Math.max(0, Number(damage || 0));
    if (!this.damageInterceptor) return safeDamage;
    const nextDamage = this.damageInterceptor(safeDamage, context);
    return Math.max(0, Number(nextDamage || 0));
  }

  applyCollision(collisionInfo, nowMs) {
    if (!this.packageActive) return;
    this.lastImpact = collisionInfo?.impact || 0;
    if (!collisionInfo?.collided) return;
    if (collisionInfo?.damageEvent === false) return;
    if (this.lastImpact <= this.minImpactForDamage) return;
    if (nowMs - this.lastDamageAtMs < this.collisionCooldownMs) return;

    const damage = this.resolveDamage(this.computeDamageBySpeed(collisionInfo), {
      system: "package",
      source: "collision",
      nowMs,
      collisionInfo,
    });
    if (damage <= 0) return;
    this.health = Math.max(0, this.health - damage);
    this.lastDamageAtMs = nowMs;
  }

  getCurrentPackageRatio() {
    if (!this.packageActive) return 0;
    if (this.maxHealth <= 0) return 0;
    return this.health / this.maxHealth;
  }

  getCurrentPackagePercent() {
    return Math.round(this.getCurrentPackageRatio() * 100);
  }

  completePackageDelivery() {
    if (!this.packageActive) return;
    this.deliveredCount += 1;
    this.deliveredQualityRatioSum += this.getCurrentPackageRatio();
  }

  getAverageQualityRatio() {
    if (this.deliveredCount <= 0) return 0;
    return this.deliveredQualityRatioSum / this.deliveredCount;
  }

  getAverageQualityPercent() {
    return Math.round(this.getAverageQualityRatio() * 100);
  }

  getColorForPercent(percent) {
    if (percent <= 25) return "#ff3f3f";
    if (percent <= 50) return "#ff9f1c";
    if (percent <= 75) return "#ffd83d";
    return "#52d273";
  }

  getHudData() {
    const packageHealthPercent = this.packageActive
      ? this.getCurrentPackagePercent()
      : null;
    const qualityPercent = this.getAverageQualityPercent();

    return {
      packageActive: this.packageActive,
      packageHealthPercent,
      packageHealthColor:
        packageHealthPercent === null
          ? "#9ca4ad"
          : this.getColorForPercent(packageHealthPercent),
      qualityPercent,
      qualityColor: this.getColorForPercent(qualityPercent),
      deliveredCount: this.deliveredCount,
      totalOrders: this.totalOrders,
    };
  }

  getHudText() {
    if (!this.packageActive) return "Vida paquete: N/A";
    const value = Math.round(this.health);
    return `Vida paquete: ${value}/${this.maxHealth}`;
  }
}
