import Phaser from "phaser";

// FPS base de referencia para convertir unidades internas.
const BASE_FPS = 60;
// Milisegundos equivalentes a un frame base.
const MS_PER_FRAME = 1000 / BASE_FPS;

export default class Moto {
  constructor(scene, x, y, inputSystem) {
    // Guarda referencia de escena.
    this.scene = scene;
    // Guarda referencia del sistema de input.
    this.input = inputSystem;

    // Aceleracion base del motor (sube para arrancar mas rapido).
    this.enginePower = .8;
    // Velocidad maxima interna (sube para mayor punta).
    this.maxSpeed = 40;
    // Fuerza base del freno (sube para frenar mas fuerte).
    this.brakePower = 0.17;
    // Friccion global constante (sube para perder inercia mas rapido).
    this.drag = 0.0095;
    // Agarre lateral (baja para derrapar mas).
    this.lateralGrip = 0.88;

    // Crea sprite fisico en posicion inicial.
    this.sprite = scene.physics.add.sprite(x, y, "moto");
    // Centra el origen del sprite.
    this.sprite.setOrigin(0.5);
    // Escala visual de la moto.
    this.sprite.setScale(0.15);
    // Limita movimiento al borde del mundo.
    this.sprite.setCollideWorldBounds(true);
    // Desactiva gravedad vertical.
    this.sprite.body.setAllowGravity(false);
    // Limita velocidad maxima del cuerpo en pixeles/segundo.
    this.sprite.body.setMaxVelocity(this.maxSpeed * 60, this.maxSpeed * 60);

    // Calcula radio de colision circular segun tamano visible.
    const radius =
      Math.min(this.sprite.displayWidth, this.sprite.displayHeight) * 0.35;
    // Aplica hitbox circular.
    this.sprite.body.setCircle(radius);
    // Ajusta offset de hitbox al centro del sprite.
    this.sprite.body.setOffset(
      this.sprite.displayWidth / 2 - radius,
      this.sprite.displayHeight / 2 - radius
    );

    // Angulo actual de la moto en radianes.
    this.direction = 0;
    // Velocidad interna acumulada en X.
    this.velX = 0;
    // Velocidad interna acumulada en Y.
    this.velY = 0;
    // Velocidad actual en px/s (para HUD/camara).
    this.speedPxPerSec = 0;
    // Velocidad tope en px/s (para normalizar).
    this.maxSpeedPxPerSec = this.maxSpeed * 60;

    // Estado actual de derrape.
    this.isDrifting = false;
    // Estado actual de frenado.
    this.isBraking = false;
  }

  update(delta = MS_PER_FRAME) {
    // Normaliza delta contra 60 FPS para estabilidad en distintos Hz.
    const dt = Phaser.Math.Clamp(delta / MS_PER_FRAME, 0, 2.5);

    // Lee estado de teclas de aceleracion/frenado/giro.
    const up = this.input.up;
    const down = this.input.down;
    const left = this.input.left;
    const right = this.input.right;
    const drift = this.input.drift;
    const brake = this.input.brake;

    // Vector frontal de la moto.
    const forwardX = Math.cos(this.direction);
    const forwardY = Math.sin(this.direction);

    // Magnitud de velocidad actual.
    const speed = Math.hypot(this.velX, this.velY);

    // Activa derrape solo a cierta velocidad minima.
    this.isDrifting = drift && speed > 1.2;
    // Activa freno si hay movimiento minimo.
    this.isBraking = brake && speed > 0.15;

    // Aceleracion frontal.
    if (up) {
      // Reduce aceleracion conforme se acerca a velocidad maxima.
      const accelFactor = Phaser.Math.Clamp(
        1 - speed / this.maxSpeed,
        0.25,
        1
      );

      // Suma impulso en X.
      this.velX += forwardX * this.enginePower * accelFactor * dt;
      // Suma impulso en Y.
      this.velY += forwardY * this.enginePower * accelFactor * dt;
    }

    // Reversa: reduce velocidad hacia adelante con un freno suave
    // y luego aplica impulso de retroceso para maniobras.
    if (down) {
      const forwardSpeed = this.velX * forwardX + this.velY * forwardY;
      if (forwardSpeed > 0) {
        const reverseDecelFactor = Phaser.Math.Clamp(1 - 0.06 * dt, 0, 1);
        this.velX *= reverseDecelFactor;
        this.velY *= reverseDecelFactor;
      }

      // Reversa limitada para maniobras cortas.
      if (speed < 5) {
        // Resta impulso en eje frontal X.
        this.velX -= forwardX * 0.7 * dt;
        // Resta impulso en eje frontal Y.
        this.velY -= forwardY * 0.7 * dt;
      }
    }

    // Frenado progresivo segun velocidad.
    if (this.isBraking) {
      // Normaliza la velocidad para aplicar mas freno en alta y menos en baja.
      const speedRatio = Phaser.Math.Clamp(speed / this.maxSpeed, 0, 1);
      // Intensidad final de frenado.
      const brakeStrength =
        this.brakePower * Phaser.Math.Linear(0.35, 1, speedRatio);
      // Convierte intensidad a multiplicador de velocidad.
      const brakeFactor = Phaser.Math.Clamp(1 - brakeStrength * dt, 0, 1);
      // Aplica frenado en X.
      this.velX *= brakeFactor;
      // Aplica frenado en Y.
      this.velY *= brakeFactor;
    }

    // Giro depende de velocidad (sin velocidad no gira casi nada).
    if (speed > 0.3) {
      // Tasa base de giro.
      const baseTurn = 0.065;
      // Escala de giro por velocidad.
      const turnFactor = Phaser.Math.Clamp(speed / this.maxSpeed, 0.25, 1);
      // Giro final con delta normalizado.
      let turn = baseTurn * turnFactor * dt;

      // Con drift activado, aumenta tasa de giro.
      if (this.isDrifting) {
        turn *= 1.5;
      }

      // Gira hacia la izquierda.
      if (left) this.direction -= turn;
      // Gira hacia la derecha.
      if (right) this.direction += turn;
    }

    // Vector lateral para calcular deslizamiento.
    const lateralX = -forwardY;
    const lateralY = forwardX;
    // Velocidad lateral proyectada.
    const lateralSpeed = this.velX * lateralX + this.velY * lateralY;
    // Con drift hay menos agarre.
    const grip = this.isDrifting ? 0.95 : this.lateralGrip;

    // Corrige componente lateral en X.
    this.velX -= lateralX * lateralSpeed * (1 - grip) * dt;
    // Corrige componente lateral en Y.
    this.velY -= lateralY * lateralSpeed * (1 - grip) * dt;

    // Friccion general continua.
    const dragFactor = Phaser.Math.Clamp(1 - this.drag * dt, 0, 1);
    // Aplica friccion en X.
    this.velX *= dragFactor;
    // Aplica friccion en Y.
    this.velY *= dragFactor;

    // Recalcula velocidad final.
    const finalSpeed = Math.hypot(this.velX, this.velY);
    // Limita velocidad maxima para evitar sobrepasos numericos.
    if (finalSpeed > this.maxSpeed) {
      // Escala correctiva al tope.
      const scale = this.maxSpeed / finalSpeed;
      // Ajusta X.
      this.velX *= scale;
      // Ajusta Y.
      this.velY *= scale;
    }

    // Convierte velocidad interna a px/s para fisica Arcade.
    this.sprite.body.setVelocity(this.velX * 60, this.velY * 60);
    // Sincroniza rotacion visual.
    this.sprite.setRotation(this.direction);

    // Feedback visual para derrape.
    if (this.isDrifting) {
      this.sprite.setTint(0x00ccff);
      // Feedback visual para frenado.
    } else if (this.isBraking) {
      this.sprite.setTint(0xff4444);
      // Estado normal sin tinte.
    } else {
      this.sprite.clearTint();
    }

    // Expone velocidad actual en px/s para HUD/camara.
    this.speedPxPerSec = Math.hypot(this.velX, this.velY) * 60;
    // Expone velocidad maxima en px/s para normalizacion externa.
    this.maxSpeedPxPerSec = this.maxSpeed * 60;
  }

  haltMotion() {
    // Detiene por completo la moto (usado para cuenta regresiva de salida).
    this.velX = 0;
    this.velY = 0;
    this.speedPxPerSec = 0;
    this.isDrifting = false;
    this.isBraking = false;
    this.sprite.body.setVelocity(0, 0);
    this.sprite.clearTint();
  }
}
