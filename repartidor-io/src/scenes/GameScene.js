import Phaser from "phaser";
import Moto from "../entities/moto.js";
import Map from "../world/Map.js";
import DebugHUD from "../ui/DebugHUD.js";

const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 6000;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("moto", "assets/sprites/moto.png");
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.driftKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );
    this.brakeKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    this.map = new Map(this, {
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });

    this.moto = new Moto(
      this,
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      this.cursors,
      this.driftKey,
      this.brakeKey
    );

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setZoom(0.85);
    cam.setDeadzone(120, 90);
    cam.startFollow(this.moto.sprite, true, 0.08, 0.08);

    this.hud = new DebugHUD(this);
  }

  update(time, delta) {
    this.moto.update(delta);
    this.hud.update(this.moto, delta);
  }
}
