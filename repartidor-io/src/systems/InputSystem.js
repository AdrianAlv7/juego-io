import Phaser from "phaser";

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
  }

  get keyboardEnabled() {
    return this.scene?.input?.keyboard?.enabled !== false;
  }

  get up() {
    // Devuelve si flecha arriba esta presionada.
    return this.keyboardEnabled && this.cursors.up.isDown;
  }

  get down() {
    // Devuelve si flecha abajo esta presionada.
    return this.keyboardEnabled && this.cursors.down.isDown;
  }

  get left() {
    // Devuelve si flecha izquierda esta presionada.
    return this.keyboardEnabled && this.cursors.left.isDown;
  }

  get right() {
    // Devuelve si flecha derecha esta presionada.
    return this.keyboardEnabled && this.cursors.right.isDown;
  }

  get drift() {
    // Devuelve si Shift esta presionada.
    return this.keyboardEnabled && this.driftKey.isDown;
  }

  get brake() {
    // Devuelve si Space esta presionada.
    return this.keyboardEnabled && this.brakeKey.isDown;
  }
}
