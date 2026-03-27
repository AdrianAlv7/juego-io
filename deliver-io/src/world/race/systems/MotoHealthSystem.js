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
    this.damageInterceptor =
      typeof options.damageInterceptor === "function"
        ? options.damageInterceptor
        : null;

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

  resolveDamage(damage, context = {}) {
    const safeDamage = Math.max(0, Number(damage || 0));
    if (!this.damageInterceptor) return safeDamage;
    const nextDamage = this.damageInterceptor(safeDamage, context);
    return Math.max(0, Number(nextDamage || 0));
  }

  applyCollision(collisionInfo, nowMs) {
    if (this.isRepairing(nowMs)) return;
    if (!collisionInfo?.collided) return;
    if (collisionInfo?.damageEvent === false) return;

    const impact = Number(collisionInfo.impact || 0);
    if (impact <= this.minImpactForDamage) return;
    if (nowMs - this.lastDamageAtMs < this.collisionCooldownMs) return;

    const damage = this.resolveDamage(this.computeDamageBySpeed(collisionInfo), {
      system: "moto",
      source: "collision",
      nowMs,
      collisionInfo,
    });
    if (damage <= 0) return;
    this.health = Math.max(0, this.health - damage);
    this.lastDamageAtMs = nowMs;
    if (this.health <= 0) {
      this.startRepair(nowMs);
    }
  }

  applyDirectDamagePercent(percent, nowMs) {
    if (this.isRepairing(nowMs)) return false;

    const damagePercent = Phaser.Math.Clamp(Number(percent) || 0, 0, 100);
    if (damagePercent <= 0) return false;

    const damage = this.resolveDamage((this.maxHealth * damagePercent) / 100, {
      system: "moto",
      source: "direct",
      nowMs,
      percent: damagePercent,
    });
    if (damage <= 0) return false;
    this.health = Math.max(0, this.health - damage);
    this.lastDamageAtMs = nowMs;

    if (this.health <= 0) {
      this.startRepair(nowMs);
    }

    return true;
  }

  update(nowMs, moto) {
    if (!moto?.sprite) return;

    if (this.repairingUntilMs > 0 && nowMs >= this.repairingUntilMs) {
      this.finishRepair(moto);
    }

    if (!this.isRepairing(nowMs)) {
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
