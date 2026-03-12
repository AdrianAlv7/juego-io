import Phaser from "phaser";
import { ITEM_TYPES } from "../items/catalog.js";

// FPS base de referencia para convertir unidades internas.
const BASE_FPS = 60;
// Milisegundos equivalentes a un frame base.
const MS_PER_FRAME = 1000 / BASE_FPS;
const DEFAULT_EVENT_HANDLING = Object.freeze({
  lateralGripMultiplier: 1,
  turnMultiplier: 1,
  dragMultiplier: 1,
  enginePowerMultiplier: 1,
  brakeMultiplier: 1,
});
// Sube este valor si quieres que el drift conserve mas inercia lateral.
// Mas alto = menos correccion lateral durante drift = arrastre mas largo.
const DRIFT_INERTIA_GRIP_BONUS = 0.01;
const DEFAULT_HEAT_CONFIG = Object.freeze({
  maxHeat: 100,
  warningHeat: 82,
  cooldownMs: 2000,
  resumeHeat: 35,
  baseGainPerFrame: 0.45,
  highSpeedGainPerFrame: 0.82,
  sustainBonusPerFrame: 1.15,
  holdRampMs: 1500,
  passiveCoolPerFrame: 1.25,
  airCoolBonusPerFrame: 0.55,
});
const DEFAULT_TRACK_ITEM_EFFECT = Object.freeze({
  active: false,
  id: "",
  type: "",
  untilMs: 0,
  brakeLocked: false,
  clearOnCollision: false,
  handling: DEFAULT_EVENT_HANDLING,
});
const DEFAULT_ITEM_IMPACT_VISUAL = Object.freeze({
  active: false,
  type: "",
  untilMs: 0,
});
const ITEM_VISUAL_COLORS = Object.freeze({
  oil: 0x050505,
  wall: 0xff2f2f,
  empPrimary: 0x3dafff,
  empSecondary: 0x8addff,
  shield: 0xffffff,
  turbo: 0xff9a31,
  drift: 0x00ccff,
  brake: 0xff4444,
});

function createTrackItemEffectState() {
  return {
    active: DEFAULT_TRACK_ITEM_EFFECT.active,
    id: DEFAULT_TRACK_ITEM_EFFECT.id,
    type: DEFAULT_TRACK_ITEM_EFFECT.type,
    untilMs: DEFAULT_TRACK_ITEM_EFFECT.untilMs,
    brakeLocked: DEFAULT_TRACK_ITEM_EFFECT.brakeLocked,
    clearOnCollision: DEFAULT_TRACK_ITEM_EFFECT.clearOnCollision,
    handling: {
      ...DEFAULT_EVENT_HANDLING,
    },
  };
}

function createEmpEffectState() {
  return {
    active: false,
    untilMs: 0,
    handling: {
      ...DEFAULT_EVENT_HANDLING,
    },
  };
}

function createTurboState() {
  return {
    active: false,
    untilMs: 0,
    maxSpeedMultiplier: 1,
    autoThrottlePower: 0,
    autoThrottleMinFactor: 0.2,
    handling: {
      ...DEFAULT_EVENT_HANDLING,
    },
  };
}

function createItemImpactVisualState() {
  return {
    active: DEFAULT_ITEM_IMPACT_VISUAL.active,
    type: DEFAULT_ITEM_IMPACT_VISUAL.type,
    untilMs: DEFAULT_ITEM_IMPACT_VISUAL.untilMs,
  };
}

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
    this.brakePower = 0.14;
    // Frenado al meter reversa: debe ayudar a detener, pero ser peor que el freno.
    this.reverseBrakePower = 0.075;
    // Potencia del motor en reversa para maniobras.
    this.reverseEnginePower = 0.42;
    // Debajo de esta velocidad hacia adelante, la reversa ya puede empezar a entrar.
    this.reverseEngageSpeed = 2.6;
    // Umbral para cerrar por completo la velocidad al frenar.
    this.brakeStopThreshold = 0.04;
    // Friccion global constante (sube para perder inercia mas rapido).
    this.drag = 0.0095;
    // Agarre lateral (baja para derrapar mas).
    this.lateralGrip = 0.88;
    // Tasa base de giro.
    this.turnRate = 0.065;

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
    // Tipo de evento activo aplicado a la moto.
    this.activeEventType = "none";
    // Multiplicadores temporales para clima/eventos.
    this.eventHandling = { ...DEFAULT_EVENT_HANDLING };
    // Configuracion de calor para el evento asoleado.
    this.heatConfig = { ...DEFAULT_HEAT_CONFIG };
    // Estado runtime del calor del motor.
    this.heatState = {
      active: false,
      value: 0,
      throttleHoldMs: 0,
      cooling: false,
      cooldownRemainingMs: 0,
      warning: false,
      statusText: "",
    };
    this.trackItemEffect = createTrackItemEffectState();
    this.empEffect = createEmpEffectState();
    this.turboState = createTurboState();
    this.shieldVisualActive = false;
    this.itemImpactVisual = createItemImpactVisualState();
  }

  update(delta = MS_PER_FRAME) {
    // Normaliza delta contra 60 FPS para estabilidad en distintos Hz.
    const dt = Phaser.Math.Clamp(delta / MS_PER_FRAME, 0, 2.5);
    const nowMs = this.scene.time.now;
    this.updateTrackItemEffect(nowMs);
    this.updateEmpEffect(nowMs);
    this.updateTurboState(nowMs);
    this.updateItemImpactVisual(nowMs);

    // Lee estado de teclas de aceleracion/frenado/giro.
    const requestedUp = this.input.up;
    const requestedDown = this.input.down;
    const left = this.input.left;
    const right = this.input.right;
    const drift = this.input.drift;
    const brake = !this.trackItemEffect.brakeLocked && this.input.brake;

    // Vector frontal de la moto.
    const forwardX = Math.cos(this.direction);
    const forwardY = Math.sin(this.direction);

    // Magnitud de velocidad actual.
    const speed = Math.hypot(this.velX, this.velY);
    const speedRatio = Phaser.Math.Clamp(speed / this.maxSpeed, 0, 1);
    const heatInfo = this.updateHeatState(delta, requestedUp, speedRatio);
    const up = requestedUp && !heatInfo.throttleLocked;
    const down = requestedDown && !heatInfo.throttleLocked;
    const combinedHandling = {
      lateralGripMultiplier:
        this.eventHandling.lateralGripMultiplier *
        this.trackItemEffect.handling.lateralGripMultiplier *
        this.empEffect.handling.lateralGripMultiplier *
        this.turboState.handling.lateralGripMultiplier,
      turnMultiplier:
        this.eventHandling.turnMultiplier *
        this.trackItemEffect.handling.turnMultiplier *
        this.empEffect.handling.turnMultiplier *
        this.turboState.handling.turnMultiplier,
      dragMultiplier:
        this.eventHandling.dragMultiplier *
        this.trackItemEffect.handling.dragMultiplier *
        this.empEffect.handling.dragMultiplier *
        this.turboState.handling.dragMultiplier,
      enginePowerMultiplier:
        this.eventHandling.enginePowerMultiplier *
        this.trackItemEffect.handling.enginePowerMultiplier *
        this.empEffect.handling.enginePowerMultiplier *
        this.turboState.handling.enginePowerMultiplier,
      brakeMultiplier:
        this.eventHandling.brakeMultiplier *
        this.trackItemEffect.handling.brakeMultiplier *
        this.empEffect.handling.brakeMultiplier *
        this.turboState.handling.brakeMultiplier,
    };
    const effectiveMaxSpeed = this.maxSpeed * this.turboState.maxSpeedMultiplier;
    const effectiveEnginePower =
      this.enginePower * combinedHandling.enginePowerMultiplier;
    const effectiveReverseEnginePower =
      this.reverseEnginePower * combinedHandling.enginePowerMultiplier;
    const effectiveTurnRate = this.turnRate * combinedHandling.turnMultiplier;
    const effectiveDrag = this.drag * combinedHandling.dragMultiplier;
    const effectiveLateralGrip = Phaser.Math.Clamp(
      this.lateralGrip * combinedHandling.lateralGripMultiplier,
      0.82,
      0.985
    );

    // Activa derrape solo a cierta velocidad minima.
    this.isDrifting = drift && speed > 1.2;
    // Mantiene estado de freno mientras la tecla este presionada
    // para conservar feedback visual continuo.
    this.isBraking = brake;

    // Aceleracion frontal.
    if (up) {
      // Reduce aceleracion conforme se acerca a velocidad maxima.
      const accelFactor = Phaser.Math.Clamp(
        1 - speed / effectiveMaxSpeed,
        0.25,
        1
      );

      // Suma impulso en X.
      this.velX += forwardX * effectiveEnginePower * accelFactor * dt;
      // Suma impulso en Y.
      this.velY += forwardY * effectiveEnginePower * accelFactor * dt;
    }

    if (this.turboState.active && this.turboState.autoThrottlePower > 0) {
      const forwardSpeed = Math.max(0, this.velX * forwardX + this.velY * forwardY);
      const turboAssistFactor = Phaser.Math.Clamp(
        1 - forwardSpeed / effectiveMaxSpeed,
        this.turboState.autoThrottleMinFactor,
        1
      );
      this.velX +=
        forwardX * this.turboState.autoThrottlePower * turboAssistFactor * dt;
      this.velY +=
        forwardY * this.turboState.autoThrottlePower * turboAssistFactor * dt;
    }

    // Reversa: reduce velocidad hacia adelante con un freno suave
    // y luego aplica impulso de retroceso para maniobras.
    if (down) {
      const forwardSpeed = this.velX * forwardX + this.velY * forwardY;
      if (forwardSpeed > 0.05) {
        const reverseBrakeRatio = Phaser.Math.Clamp(
          forwardSpeed / effectiveMaxSpeed,
          0,
          1
        );
        const reverseBrakeStrength =
          this.reverseBrakePower *
          Phaser.Math.Linear(0.28, 0.85, reverseBrakeRatio);
        const reverseBrakeFactor = Phaser.Math.Clamp(
          1 - reverseBrakeStrength * dt,
          0,
          1
        );
        this.velX *= reverseBrakeFactor;
        this.velY *= reverseBrakeFactor;

        const reverseAssistBlend = Phaser.Math.Clamp(
          1 - forwardSpeed / this.reverseEngageSpeed,
          0,
          1
        );
        if (reverseAssistBlend > 0) {
          const reverseSpeed = 0;
          const reverseAccelFactor = Phaser.Math.Clamp(1 - reverseSpeed / 6, 0.2, 1);
          const reverseAssistPower =
            effectiveReverseEnginePower *
            Phaser.Math.Linear(0.18, 0.72, reverseAssistBlend);
          this.velX -= forwardX * reverseAssistPower * reverseAccelFactor * dt;
          this.velY -= forwardY * reverseAssistPower * reverseAccelFactor * dt;
        }
      } else {
        const reverseSpeed = Math.max(0, -forwardSpeed);
        const reverseAccelFactor = Phaser.Math.Clamp(1 - reverseSpeed / 6, 0.2, 1);
        // Resta impulso en eje frontal X.
        this.velX -=
          forwardX * effectiveReverseEnginePower * reverseAccelFactor * dt;
        // Resta impulso en eje frontal Y.
        this.velY -=
          forwardY * effectiveReverseEnginePower * reverseAccelFactor * dt;
      }
    }

    // Frenado progresivo segun velocidad.
    if (this.isBraking) {
      // Normaliza la velocidad para aplicar mas freno en alta y menos en baja.
      const speedRatio = Phaser.Math.Clamp(speed / effectiveMaxSpeed, 0, 1);
      // Intensidad final de frenado.
      const brakeStrength =
        this.brakePower *
        combinedHandling.brakeMultiplier *
        Phaser.Math.Linear(0.35, 1, speedRatio);
      // Convierte intensidad a multiplicador de velocidad.
      const brakeFactor = Phaser.Math.Clamp(1 - brakeStrength * dt, 0, 1);
      // Aplica frenado en X.
      this.velX *= brakeFactor;
      // Aplica frenado en Y.
      this.velY *= brakeFactor;

      // Frenado de cierre: evita que quede arrastre infinito en baja velocidad.
      // Solo aplica fuerte si NO viene acelerando ni metiendo reversa.
      if (!up && !down) {
        const speedAfterBrake = Math.hypot(this.velX, this.velY);
        if (speedAfterBrake > 0) {
          const fullStopDecel = Phaser.Math.Linear(0.075, 0.012, speedRatio) * dt;
          const nextSpeed = Math.max(0, speedAfterBrake - fullStopDecel);
          const scale = nextSpeed / speedAfterBrake;
          this.velX *= scale;
          this.velY *= scale;
        }

        // Cierre total al llegar al umbral minimo.
        const speedAfterFullBrake = Math.hypot(this.velX, this.velY);
        if (speedAfterFullBrake <= this.brakeStopThreshold) {
          this.velX = 0;
          this.velY = 0;
        }
      }
    }

    // Giro depende de velocidad (sin velocidad no gira casi nada).
    if (speed > 0.3) {
      // Escala de giro por velocidad.
      const turnFactor = Phaser.Math.Clamp(speed / effectiveMaxSpeed, 0.25, 1);
      // Giro final con delta normalizado.
      let turn = effectiveTurnRate * turnFactor * dt;

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
    const grip = this.isDrifting
      ? Math.min(0.995, effectiveLateralGrip + DRIFT_INERTIA_GRIP_BONUS)
      : effectiveLateralGrip;

    // Corrige componente lateral en X.
    this.velX -= lateralX * lateralSpeed * (1 - grip) * dt;
    // Corrige componente lateral en Y.
    this.velY -= lateralY * lateralSpeed * (1 - grip) * dt;

    // Friccion general continua.
    const dragFactor = Phaser.Math.Clamp(1 - effectiveDrag * dt, 0, 1);
    // Aplica friccion en X.
    this.velX *= dragFactor;
    // Aplica friccion en Y.
    this.velY *= dragFactor;

    // Recalcula velocidad final.
    const finalSpeed = Math.hypot(this.velX, this.velY);
    // Limita velocidad maxima para evitar sobrepasos numericos.
    if (finalSpeed > effectiveMaxSpeed) {
      // Escala correctiva al tope.
      const scale = effectiveMaxSpeed / finalSpeed;
      // Ajusta X.
      this.velX *= scale;
      // Ajusta Y.
      this.velY *= scale;
    }

    // Convierte velocidad interna a px/s para fisica Arcade.
    this.sprite.body.setMaxVelocity(effectiveMaxSpeed * 60, effectiveMaxSpeed * 60);
    this.sprite.body.setVelocity(this.velX * 60, this.velY * 60);
    // Sincroniza rotacion visual.
    this.sprite.setRotation(this.direction);
    this.applyVisualFeedback(nowMs);

    // Expone velocidad actual en px/s para HUD/camara.
    this.speedPxPerSec = Math.hypot(this.velX, this.velY) * 60;
    // Expone velocidad maxima en px/s para normalizacion externa.
    this.maxSpeedPxPerSec = effectiveMaxSpeed * 60;
  }

  updateHeatState(deltaMs, throttleHeld, speedRatio) {
    if (!this.heatState.active) {
      return { throttleLocked: false };
    }

    const dt = Phaser.Math.Clamp(deltaMs / MS_PER_FRAME, 0, 2.5);

    if (this.heatState.cooling) {
      this.heatState.cooldownRemainingMs = Math.max(
        0,
        this.heatState.cooldownRemainingMs - deltaMs
      );
      this.heatState.throttleHoldMs = 0;
      this.heatState.warning = false;
      this.heatState.statusText = "Enfriando";
      this.heatState.value = Math.max(
        this.heatConfig.resumeHeat,
        this.heatState.value - this.heatConfig.passiveCoolPerFrame * 2.2 * dt
      );

      if (this.heatState.cooldownRemainingMs <= 0) {
        this.heatState.cooling = false;
        this.heatState.value = Math.min(
          this.heatState.value,
          this.heatConfig.resumeHeat
        );
        this.heatState.statusText = "";
      }

      return { throttleLocked: true };
    }

    if (throttleHeld) {
      this.heatState.throttleHoldMs = Math.min(
        this.heatConfig.holdRampMs,
        this.heatState.throttleHoldMs + deltaMs
      );
      const holdRatio = Phaser.Math.Clamp(
        this.heatState.throttleHoldMs / this.heatConfig.holdRampMs,
        0,
        1
      );
      const gainPerFrame =
        Phaser.Math.Linear(
          this.heatConfig.baseGainPerFrame,
          this.heatConfig.highSpeedGainPerFrame,
          speedRatio
        ) +
        holdRatio * this.heatConfig.sustainBonusPerFrame;
      this.heatState.value = Math.min(
        this.heatConfig.maxHeat,
        this.heatState.value + gainPerFrame * dt
      );
    } else {
      this.heatState.throttleHoldMs = Math.max(
        0,
        this.heatState.throttleHoldMs - deltaMs * 1.8
      );
      const coolPerFrame =
        this.heatConfig.passiveCoolPerFrame +
        speedRatio * this.heatConfig.airCoolBonusPerFrame;
      this.heatState.value = Math.max(0, this.heatState.value - coolPerFrame * dt);
    }

    if (this.heatState.value >= this.heatConfig.maxHeat) {
      this.startHeatCooldown();
      return { throttleLocked: true };
    }

    this.heatState.warning = this.heatState.value >= this.heatConfig.warningHeat;
    this.heatState.statusText = this.heatState.warning ? "Sobrecalentado" : "";
    return { throttleLocked: false };
  }

  startHeatCooldown() {
    this.heatState.cooling = true;
    this.heatState.cooldownRemainingMs = this.heatConfig.cooldownMs;
    this.heatState.throttleHoldMs = 0;
    this.heatState.warning = false;
    this.heatState.statusText = "Enfriando";
    this.heatState.value = this.heatConfig.maxHeat;
  }

  setWeatherEvent(eventConfig = null) {
    this.activeEventType = eventConfig?.type || "none";
    this.eventHandling = {
      ...DEFAULT_EVENT_HANDLING,
      ...(eventConfig?.handling || {}),
    };

    if (eventConfig?.heat) {
      this.heatConfig = {
        ...DEFAULT_HEAT_CONFIG,
        ...eventConfig.heat,
      };
      this.heatState.active = true;
      this.heatState.warning = false;
      this.heatState.statusText = "";
    } else {
      this.resetHeatState();
    }
  }

  applyTrackItemEffect(effectConfig = {}) {
    const nowMs = this.scene.time.now;
    const durationMs = Math.max(0, Number(effectConfig.durationMs || 0));
    this.trackItemEffect = {
      active: true,
      id: effectConfig.id || "",
      type: effectConfig.type || "",
      untilMs: durationMs > 0 ? nowMs + durationMs : 0,
      brakeLocked: Boolean(effectConfig.brakeLocked),
      clearOnCollision: Boolean(effectConfig.clearOnCollision),
      handling: {
        ...DEFAULT_EVENT_HANDLING,
        ...(effectConfig.handling || {}),
      },
    };
    this.applyVisualFeedback(nowMs);
  }

  clearTrackItemEffect() {
    this.trackItemEffect = createTrackItemEffectState();
    this.applyVisualFeedback(this.scene.time.now);
  }

  updateTrackItemEffect(nowMs) {
    if (!this.trackItemEffect.active) return;
    if (this.trackItemEffect.untilMs > 0 && nowMs >= this.trackItemEffect.untilMs) {
      this.clearTrackItemEffect();
    }
  }

  handleTrackCollision(collisionInfo = {}) {
    if (!this.trackItemEffect.active) return;
    if (!this.trackItemEffect.clearOnCollision) return;
    if (!collisionInfo?.justCollided) return;
    this.clearTrackItemEffect();
  }

  applyEmpEffect(effectConfig = {}) {
    const nowMs = this.scene.time.now;
    const durationMs = Math.max(0, Number(effectConfig.durationMs || 0));
    const initialSpeedFactor = Phaser.Math.Clamp(
      Number(effectConfig.initialSpeedFactor || 0.74),
      0.45,
      1
    );
    this.velX *= initialSpeedFactor;
    this.velY *= initialSpeedFactor;
    this.empEffect = {
      active: true,
      untilMs: durationMs > 0 ? nowMs + durationMs : 0,
      handling: {
        ...DEFAULT_EVENT_HANDLING,
        ...(effectConfig.handling || {}),
      },
    };
    this.sprite.body.setVelocity(this.velX * 60, this.velY * 60);
    this.applyVisualFeedback(nowMs);
  }

  clearEmpEffect() {
    this.empEffect = createEmpEffectState();
    this.applyVisualFeedback(this.scene.time.now);
  }

  updateEmpEffect(nowMs) {
    if (!this.empEffect.active) return;
    if (this.empEffect.untilMs > 0 && nowMs >= this.empEffect.untilMs) {
      this.clearEmpEffect();
    }
  }

  activateTurbo(turboConfig = {}) {
    const nowMs = this.scene.time.now;
    const durationMs = Math.max(120, Number(turboConfig.durationMs || 950));
    const impulse = Math.max(0, Number(turboConfig.forwardImpulse || 0));
    const forwardX = Math.cos(this.direction);
    const forwardY = Math.sin(this.direction);

    this.velX += forwardX * impulse;
    this.velY += forwardY * impulse;
    this.turboState = {
      active: true,
      untilMs: nowMs + durationMs,
      maxSpeedMultiplier: Math.max(1, Number(turboConfig.maxSpeedMultiplier || 1)),
      autoThrottlePower: Math.max(0, Number(turboConfig.autoThrottlePower || 0)),
      autoThrottleMinFactor: Phaser.Math.Clamp(
        Number(turboConfig.autoThrottleMinFactor || 0.2),
        0.12,
        0.65
      ),
      handling: {
        ...DEFAULT_EVENT_HANDLING,
        ...(turboConfig.handling || {}),
      },
    };
    this.applyVisualFeedback(nowMs);
    return true;
  }

  clearTurboState() {
    this.turboState = createTurboState();
    this.applyVisualFeedback(this.scene.time.now);
  }

  updateTurboState(nowMs) {
    if (!this.turboState.active) return;
    if (this.turboState.untilMs > 0 && nowMs >= this.turboState.untilMs) {
      this.clearTurboState();
    }
  }

  resetHeatState() {
    this.heatConfig = { ...DEFAULT_HEAT_CONFIG };
    this.heatState = {
      active: false,
      value: 0,
      throttleHoldMs: 0,
      cooling: false,
      cooldownRemainingMs: 0,
      warning: false,
      statusText: "",
    };
  }

  getHudState() {
    return {
      weatherEventType: this.activeEventType,
      heat: {
        active: this.heatState.active,
        value: this.heatState.value,
        max: this.heatConfig.maxHeat,
        percent:
          this.heatConfig.maxHeat > 0
            ? Phaser.Math.Clamp(
                this.heatState.value / this.heatConfig.maxHeat,
                0,
                1
              )
            : 0,
        cooling: this.heatState.cooling,
        cooldownRemainingMs: this.heatState.cooldownRemainingMs,
        statusText: this.heatState.statusText,
      },
      trackItem: {
        active: this.trackItemEffect.active,
        type: this.trackItemEffect.type,
      },
      turbo: {
        active: this.turboState.active,
      },
      emp: {
        active: this.empEffect.active,
      },
    };
  }

  setShieldVisualActive(active) {
    this.shieldVisualActive = Boolean(active);
    this.applyVisualFeedback(this.scene.time.now);
  }

  flashItemImpactVisual(type = ITEM_TYPES.WALL, durationMs = 260) {
    const nowMs = this.scene.time.now;
    this.itemImpactVisual = {
      active: true,
      type: type || ITEM_TYPES.WALL,
      untilMs: nowMs + Math.max(80, Number(durationMs || 260)),
    };
    this.applyVisualFeedback(nowMs);
  }

  updateItemImpactVisual(nowMs) {
    if (!this.itemImpactVisual.active) return;
    if (this.itemImpactVisual.untilMs > 0 && nowMs >= this.itemImpactVisual.untilMs) {
      this.itemImpactVisual = createItemImpactVisualState();
    }
  }

  applyTint(color, useFill = false) {
    if (!this.sprite) return;
    if (useFill && typeof this.sprite.setTintFill === "function") {
      this.sprite.setTintFill(color, color, color, color);
      return;
    }
    this.sprite.setTint(color, color, color, color);
  }

  applyVisualFeedback(nowMs = this.scene.time.now) {
    if (!this.sprite) return;

    let tintColor = null;
    let useFill = false;
    let alpha = 1;

    if (this.itemImpactVisual.active && this.itemImpactVisual.type === ITEM_TYPES.WALL) {
      tintColor = ITEM_VISUAL_COLORS.wall;
      useFill = true;
    } else if (this.empEffect.active) {
      const wave = 0.5 + 0.5 * Math.sin(nowMs * 0.085);
      tintColor =
        wave > 0.53
          ? ITEM_VISUAL_COLORS.empPrimary
          : ITEM_VISUAL_COLORS.empSecondary;
      useFill = true;
      alpha = 0.78 + wave * 0.22;
    } else if (this.shieldVisualActive) {
      tintColor = ITEM_VISUAL_COLORS.shield;
      useFill = true;
      alpha = 0.95;
    } else if (
      this.trackItemEffect.active &&
      this.trackItemEffect.type === ITEM_TYPES.OIL
    ) {
      tintColor = ITEM_VISUAL_COLORS.oil;
      useFill = true;
    } else if (this.turboState.active) {
      tintColor = ITEM_VISUAL_COLORS.turbo;
      useFill = true;
    } else if (this.isDrifting) {
      tintColor = ITEM_VISUAL_COLORS.drift;
    } else if (this.isBraking) {
      tintColor = ITEM_VISUAL_COLORS.brake;
    }

    if (tintColor === null) {
      this.sprite.clearTint();
    } else {
      this.applyTint(tintColor, useFill);
    }
    this.sprite.setAlpha(alpha);
  }

  haltMotion() {
    // Detiene por completo la moto (usado para cuenta regresiva de salida).
    this.velX = 0;
    this.velY = 0;
    this.speedPxPerSec = 0;
    this.isDrifting = false;
    this.isBraking = false;
    this.heatState.throttleHoldMs = 0;
    this.sprite.body.setVelocity(0, 0);
    this.applyVisualFeedback(this.scene.time.now);
  }
}
