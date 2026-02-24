import Phaser from "phaser";

const BASE_FPS = 60;
const MS_PER_FRAME = 1000 / BASE_FPS;

export default class Moto {
  constructor(scene, x, y, inputSystem) {
    this.scene = scene;
    this.input = inputSystem;

    this.enginePower = 0.7;
    this.maxSpeed = 35;
    this.brakePower = 0.15;
    this.drag = 0.01;
    this.lateralGrip = 0.88;

    this.sprite = scene.physics.add.sprite(x, y, "moto");
    this.sprite.setOrigin(0.5);
    this.sprite.setScale(0.15);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setMaxVelocity(this.maxSpeed * 60, this.maxSpeed * 60);

    const radius =
      Math.min(this.sprite.displayWidth, this.sprite.displayHeight) * 0.35;
    this.sprite.body.setCircle(radius);
    this.sprite.body.setOffset(
      this.sprite.displayWidth / 2 - radius,
      this.sprite.displayHeight / 2 - radius
    );

    this.direction = 0;
    this.velX = 0;
    this.velY = 0;
    this.speedPxPerSec = 0;

    this.isDrifting = false;
    this.isBraking = false;
  }

  update(delta = MS_PER_FRAME) {
    const dt = Phaser.Math.Clamp(delta / MS_PER_FRAME, 0, 2.5);

    const up = this.input.up;
    const down = this.input.down;
    const left = this.input.left;
    const right = this.input.right;
    const drift = this.input.drift;
    const brake = this.input.brake;

    const forwardX = Math.cos(this.direction);
    const forwardY = Math.sin(this.direction);

    const speed = Math.hypot(this.velX, this.velY);

    this.isDrifting = drift && speed > 1.2;
    this.isBraking = brake && speed > 0.2;

    if (up) {
      const accelFactor = Phaser.Math.Clamp(
        1 - speed / this.maxSpeed,
        0.25,
        1
      );

      this.velX += forwardX * this.enginePower * accelFactor * dt;
      this.velY += forwardY * this.enginePower * accelFactor * dt;
    }

    if (down && speed < 3) {
      this.velX -= forwardX * 0.08 * dt;
      this.velY -= forwardY * 0.08 * dt;
    }

    if (this.isBraking) {
      const brakeFactor = Phaser.Math.Clamp(1 - this.brakePower * dt, 0, 1);
      this.velX *= brakeFactor;
      this.velY *= brakeFactor;
    }

    if (speed > 0.3) {
      const baseTurn = 0.065;
      const turnFactor = Phaser.Math.Clamp(speed / this.maxSpeed, 0.25, 1);
      let turn = baseTurn * turnFactor * dt;

      if (this.isDrifting) {
        turn *= 1.5;
      }

      if (left) this.direction -= turn;
      if (right) this.direction += turn;
    }

    const lateralX = -forwardY;
    const lateralY = forwardX;
    const lateralSpeed = this.velX * lateralX + this.velY * lateralY;
    const grip = this.isDrifting ? 0.95 : this.lateralGrip;

    this.velX -= lateralX * lateralSpeed * (1 - grip) * dt;
    this.velY -= lateralY * lateralSpeed * (1 - grip) * dt;

    const dragFactor = Phaser.Math.Clamp(1 - this.drag * dt, 0, 1);
    this.velX *= dragFactor;
    this.velY *= dragFactor;

    const finalSpeed = Math.hypot(this.velX, this.velY);
    if (finalSpeed > this.maxSpeed) {
      const scale = this.maxSpeed / finalSpeed;
      this.velX *= scale;
      this.velY *= scale;
    }

    this.sprite.body.setVelocity(this.velX * 60, this.velY * 60);
    this.sprite.setRotation(this.direction);

    if (this.isDrifting) {
      this.sprite.setTint(0x00ccff);
    } else if (this.isBraking) {
      this.sprite.setTint(0xff4444);
    } else {
      this.sprite.clearTint();
    }

    this.speedPxPerSec = Math.hypot(this.velX, this.velY) * 60;
  }
}
