import Phaser from "phaser";

export default class InputSystem {
  constructor(scene) {
    this.scene = scene;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.driftKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );
    this.brakeKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
  }

  get up() {
    return this.cursors.up.isDown;
  }

  get down() {
    return this.cursors.down.isDown;
  }

  get left() {
    return this.cursors.left.isDown;
  }

  get right() {
    return this.cursors.right.isDown;
  }

  get drift() {
    return this.driftKey.isDown;
  }

  get brake() {
    return this.brakeKey.isDown;
  }
}
