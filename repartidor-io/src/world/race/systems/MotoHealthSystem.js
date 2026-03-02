import Phaser from "phaser";

export default class MotoHealthSystem {
  constructor(options = {}) {
    this.maxHealth = Math.max(1, Number(options.maxHealth || 280));
    this.minImpactForDamage = Number(options.minImpactForDamage || 0.75);
    this.collisionDamageFactor = Number(options.collisionDamageFactor || 0.09);
    this.collisionCooldownMs = Math.max(
      80,
      Number(options.collisionCooldownMs || 180)
    );
    this.repairDurationMs = Math.max(900, Number(options.repairDurationMs || 1800));

    this.health = this.maxHealth;
    this.repairingUntilMs = 0;
    this.repairStartedAtMs = 0;
    this.lastDamageAtMs = -Infinity;
  }

  isRepairing(nowMs) {
    return this.repairingUntilMs > nowMs;
  }

  getHealthRatio() {
    if (this.maxHealth <= 0) return 0;
    return Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
  }

  getHealthPercent() {
    return Math.round(this.getHealthRatio() * 100);
  }

  getColorForPercent(percent) {
    if (percent <= 25) return "#ff3f3f";
    if (percent <= 50) return "#ff9f1c";
    if (percent <= 75) return "#ffd83d";
    return "#52d273";
  }

  startRepair(nowMs) {
    this.health = 0;
    this.repairStartedAtMs = nowMs;
    this.repairingUntilMs = nowMs + this.repairDurationMs;
  }

  finishRepair(moto) {
    this.health = this.maxHealth;
    this.repairStartedAtMs = 0;
    this.repairingUntilMs = 0;
    if (moto?.sprite) {
      moto.sprite.clearTint();
      moto.sprite.setAlpha(1);
    }
  }

  computeDamageBySpeed(collisionInfo) {
    const speedKmh = Number(collisionInfo?.speedKmh || 0);
    const impact = Number(collisionInfo?.impact || 0);

    const speedNorm = Math.min(1, Math.max(0, (speedKmh - 20) / 150));
    const minPercent = 1 + speedNorm * 8;
    const maxPercent = 3 + speedNorm * 10;
    const randomPercent = minPercent + Math.random() * (maxPercent - minPercent);
    const impactScale = Math.min(1, Math.max(0.55, impact / 6));
    const damagePercent =
      randomPercent * impactScale * this.collisionDamageFactor * 11.5;
    return (this.maxHealth * damagePercent) / 100;
  }

  applyCollision(collisionInfo, nowMs) {
    if (this.isRepairing(nowMs)) return;
    if (!collisionInfo?.collided) return;

    const impact = Number(collisionInfo.impact || 0);
    if (impact <= this.minImpactForDamage) return;
    if (nowMs - this.lastDamageAtMs < this.collisionCooldownMs) return;

    const damage = this.computeDamageBySpeed(collisionInfo);
    this.health = Math.max(0, this.health - damage);
    this.lastDamageAtMs = nowMs;
    if (this.health <= 0) {
      this.startRepair(nowMs);
    }
  }

  update(nowMs, moto) {
    if (!moto?.sprite) return;

    if (this.repairingUntilMs > 0 && nowMs >= this.repairingUntilMs) {
      this.finishRepair(moto);
    }

    if (!this.isRepairing(nowMs)) {
      moto.sprite.setAlpha(1);
      return;
    }

    const remainingMs = Math.max(0, this.repairingUntilMs - nowMs);
    const pulse = 0.62 + 0.38 * Math.sin(nowMs * 0.03);
    moto.sprite.setTint(pulse > 0.5 ? 0xffb347 : 0xff5f5f);
    moto.sprite.setAlpha(0.58 + pulse * 0.35);

    if (remainingMs <= 0) this.finishRepair(moto);
  }

  getHudData(nowMs) {
    const repairing = this.isRepairing(nowMs);
    const remainingMs = repairing ? Math.max(0, this.repairingUntilMs - nowMs) : 0;
    const percent = this.getHealthPercent();

    return {
      healthPercent: percent,
      healthColor: this.getColorForPercent(percent),
      repairing,
      repairRemainingMs: remainingMs,
      repairDurationMs: this.repairDurationMs,
    };
  }
}
