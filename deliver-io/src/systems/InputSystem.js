import Phaser from "phaser";
import {
  CONTROL_PRESET_IDS,
  loadControlPresetId,
  normalizeControlPresetId,
} from "./controlPresets.js";

export default class InputSystem {
  constructor(scene) {
    // Guarda referencia a la escena dueña del input.
    this.scene = scene;
    // Crea acceso rapido a flechas (arriba/abajo/izquierda/derecha).
    this.cursors = scene.input.keyboard.createCursorKeys();
    // Tecla Shift para activar derrape.
    this.driftKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );
    // Tecla Space para activar freno.
    this.brakeKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    // Teclas alternativas del preset WASD.
    this.wKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.sKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.dKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    // Teclas de acciones por preset.
    this.dropItemArrowsKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.Z
    );
    this.dropItemWasdKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.K
    );
    this.turboArrowsKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.X
    );
    this.turboWasdKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.L
    );

    this.controlPresetId = loadControlPresetId();
  }

  get keyboardEnabled() {
    return this.scene?.input?.keyboard?.enabled !== false;
  }

  getControlPresetId() {
    return this.controlPresetId;
  }

  setControlPreset(presetId) {
    this.controlPresetId = normalizeControlPresetId(presetId);
    return this.controlPresetId;
  }

  get movementPresetIsWasd() {
    return this.controlPresetId === CONTROL_PRESET_IDS.WASD;
  }

  get up() {
    // Devuelve si la tecla de "acelerar" esta presionada segun preset.
    const source = this.movementPresetIsWasd ? this.wKey : this.cursors.up;
    return this.keyboardEnabled && source.isDown;
  }

  get down() {
    // Devuelve si la tecla de "reversa" esta presionada segun preset.
    const source = this.movementPresetIsWasd ? this.sKey : this.cursors.down;
    return this.keyboardEnabled && source.isDown;
  }

  get left() {
    // Devuelve si la tecla de giro izquierdo esta presionada segun preset.
    const source = this.movementPresetIsWasd ? this.aKey : this.cursors.left;
    return this.keyboardEnabled && source.isDown;
  }

  get right() {
    // Devuelve si la tecla de giro derecho esta presionada segun preset.
    const source = this.movementPresetIsWasd ? this.dKey : this.cursors.right;
    return this.keyboardEnabled && source.isDown;
  }

  get drift() {
    // Devuelve si Shift esta presionada.
    return this.keyboardEnabled && this.driftKey.isDown;
  }

  get brake() {
    // Devuelve si Space esta presionada.
    return this.keyboardEnabled && this.brakeKey.isDown;
  }

  isDropItemJustPressed() {
    if (!this.keyboardEnabled) return false;
    const source = this.movementPresetIsWasd
      ? this.dropItemWasdKey
      : this.dropItemArrowsKey;
    return Phaser.Input.Keyboard.JustDown(source);
  }

  isTurboJustPressed() {
    if (!this.keyboardEnabled) return false;
    const source = this.movementPresetIsWasd
      ? this.turboWasdKey
      : this.turboArrowsKey;
    return Phaser.Input.Keyboard.JustDown(source);
  }
}
