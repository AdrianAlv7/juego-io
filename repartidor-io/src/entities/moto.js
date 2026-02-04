import Phaser from "phaser";

export default class Moto {
  constructor(scene, x, y, cursors, driftKey, brakeKey) {
    this.scene = scene;
    this.cursors = cursors;
    this.driftKey = driftKey;
    this.brakeKey = brakeKey;

    // SPRITE
    this.sprite = scene.add.sprite(x, y, "moto");
    this.sprite.setOrigin(0.5);
    this.sprite.setScale(0.15);

    // ORIENTACIÓN
    this.direction = 0;

    // VELOCIDAD REAL (vector)
    this.velX = 0;
    this.velY = 0;

    // ESTADOS
    this.isDrifting = false;
    this.isBraking = false;

    // CONFIGURACIÓN DE FEELING
    this.enginePower = 0.25;   // fuerza del motor
    this.maxSpeed = 15;         // velocidad máxima
    this.brakePower = 0.15;    // fuerza de freno
    this.drag = 0.01;          // fricción general
    this.lateralGrip = 0.88;   // agarre lateral normal

    console.log("🏍️ Moto creada en:", x, y);
  }

  update() {
    // ---------------- INPUT ----------------
    const up = this.cursors.up.isDown;
    const down = this.cursors.down.isDown;
    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const drift = this.driftKey.isDown;
    const brake = this.brakeKey.isDown;

    // ---------------- VECTORES ----------------
    const forwardX = Math.cos(this.direction);
    const forwardY = Math.sin(this.direction);

    const speed = Math.hypot(this.velX, this.velY);

    // ---------------- ESTADOS ----------------
    this.isDrifting = drift && speed > 1.2;
    this.isBraking = brake && speed > 0.2;

    // ---------------- ACELERACIÓN ----------------
    if (up) {
      // Acelera menos mientras más rápido vas (feeling real)
      const accelFactor = Phaser.Math.Clamp(
        1 - speed / this.maxSpeed,
        0.25,
        1
      );

      this.velX += forwardX * this.enginePower * accelFactor;
      this.velY += forwardY * this.enginePower * accelFactor;
    }

    // REVERSA SUAVE (no dominante)
    if (down && speed < 3) {
      this.velX -= forwardX * 0.08;
      this.velY -= forwardY * 0.08;
    }

    // ---------------- FRENO PROGRESIVO ----------------
    if (this.isBraking) {
      this.velX *= 1 - this.brakePower;
      this.velY *= 1 - this.brakePower;
    }

    // ---------------- GIRO DEPENDIENTE DE VELOCIDAD ----------------
    if (speed > 0.3) {
      const baseTurn = 0.045;
      const turnFactor = Phaser.Math.Clamp(speed / this.maxSpeed, 0.25, 1);
      let turn = baseTurn * turnFactor;

      if (this.isDrifting) turn *= 1.5;

      if (left) this.direction -= turn;
      if (right) this.direction += turn;
    }

    // ---------------- DERRAPE / AGARRE LATERAL ----------------
    const lateralX = -forwardY;
    const lateralY = forwardX;

    const lateralSpeed =
      this.velX * lateralX + this.velY * lateralY;

    const grip = this.isDrifting ? 0.95 : this.lateralGrip;

    this.velX -= lateralX * lateralSpeed * (1 - grip);
    this.velY -= lateralY * lateralSpeed * (1 - grip);

    // ---------------- FRICCIÓN GENERAL ----------------
    this.velX *= 1 - this.drag;
    this.velY *= 1 - this.drag;

    // ---------------- LIMITAR VELOCIDAD ----------------
    const finalSpeed = Math.hypot(this.velX, this.velY);
    if (finalSpeed > this.maxSpeed) {
      const scale = this.maxSpeed / finalSpeed;
      this.velX *= scale;
      this.velY *= scale;
    }

    // ---------------- MOVIMIENTO ----------------
    this.sprite.x += this.velX;
    this.sprite.y += this.velY;
    this.sprite.rotation = this.direction;

    // ---------------- FEEDBACK VISUAL ----------------
    if (this.isDrifting) {
      this.sprite.setTint(0x00ccff); // azul drift
    } else if (this.isBraking) {
      this.sprite.setTint(0xff4444); // rojo freno
    } else {
      this.sprite.clearTint();
    }

    // ---------------- DEBUG ----------------
    console.log({
      speed: finalSpeed.toFixed(2),
      drifting: this.isDrifting,
      braking: this.isBraking
    });
  }
}
