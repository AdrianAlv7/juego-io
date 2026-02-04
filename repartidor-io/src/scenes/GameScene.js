import Phaser from "phaser";
import Moto from "../entities/moto.js";
import Map from "../world/Map.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("moto", "assets/moto.png");
  }

  create() {
    console.log("🎮 GameScene create");

    // input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.driftKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );
    this.brakeKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    // mapa
    this.map = new Map(this);

    // moto (arranca lejos del borde)
    this.moto = new Moto(
      this,
      2000,
      2000,
      this.cursors,
      this.driftKey,
      this.brakeKey
    );

    // cámara
    const cam = this.cameras.main;
    cam.setBounds(0, 0, 4000, 4000);
    cam.startFollow(this.moto.sprite, true, 0.08, 0.08);

    console.log("📷 Cámara siguiendo la moto");
  }

  update() {
    this.moto.update();
  }
}
