export default class PlayerHealthSystem {
  constructor(options) {
    this.maxHealth = options.maxHealth;
    this.minImpactForDamage = options.minImpactForDamage;
    this.collisionDamageFactor = options.collisionDamageFactor;
    this.health = this.maxHealth;
    this.packageActive = false;
    this.lastImpact = 0;
  }

  startPackage() {
    // Cada paquete nuevo inicia con vida completa.
    this.packageActive = true;
    this.health = this.maxHealth;
  }

  clearPackage() {
    // Sin paquete no hay vida que mostrar ni dañar.
    this.packageActive = false;
    this.lastImpact = 0;
  }

  applyCollision(collisionInfo) {
    if (!this.packageActive) return;
    this.lastImpact = collisionInfo?.impact || 0;
    if (!collisionInfo?.collided) return;
    if (this.lastImpact <= this.minImpactForDamage) return;

    const damage = (this.lastImpact - this.minImpactForDamage) * this.collisionDamageFactor;
    this.health = Math.max(0, this.health - damage);
  }

  getRatio() {
    if (!this.packageActive) return 0;
    if (this.maxHealth <= 0) return 0;
    return this.health / this.maxHealth;
  }

  getHudText() {
    if (!this.packageActive) return "Vida paquete: N/A";
    const value = Math.round(this.health);
    return `Vida paquete: ${value}/${this.maxHealth}`;
  }
}
