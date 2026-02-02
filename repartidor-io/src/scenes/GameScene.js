import Phaser from "phaser";
import Moto from "../entities/moto.js";
import Map from "../world/Map.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

preload() {
  // MAPA
  this.load.tilemapTiledJSON("track", "assets/maps/pista1.json");

  // TILESET
  this.load.image("tiles", "assets/tiles/pista_tiles.png");

  // MOTO
  this.load.image("moto", "assets/sprites/moto.png");
}


create() {
  console.log("🎮 GameScene create");

  // 1️⃣ MAPA
  const map = this.make.tilemap({ key: "track" });

  const tileset = map.addTilesetImage(
    "pista_tiles", // nombre EXACTO del tileset en Tiled
    "tiles"        // key que cargaste en preload
  );

  // 2️⃣ CAPAS
  const ground = map.createLayer("ground", tileset);
  const walls = map.createLayer("walls", tileset);

  walls.setCollisionByProperty({ collides: true });

  // 3️⃣ SPAWN DESDE TILED
  const spawnLayer = map.getObjectLayer("spawn");
  const spawnPoint = spawnLayer.objects.find(o => o.name === "player");

  // 4️⃣ MOTO
  this.moto = new Moto(
    this,
    spawnPoint.x,
    spawnPoint.y,
    this.input.keyboard.createCursorKeys(),
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  );

  // 5️⃣ FÍSICAS
  this.physics.add.existing(this.moto.sprite);
  this.moto.sprite.body.setCollideWorldBounds(true);

  this.physics.add.collider(this.moto.sprite, walls);

  // 6️⃣ CÁMARA
  this.cameras.main.startFollow(this.moto.sprite);
}


  update() {
    this.moto.update();
  }
}
