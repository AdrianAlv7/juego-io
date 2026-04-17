import Phaser from "phaser";
import tiledPreviewUrl from "../../tiled/map.png";
import BuildingFakeDepth from "../world/fakeDepth/BuildingFakeDepth.js";
import { createFakeDepthCityLayout } from "../world/fakeDepth/fakeDepthCityLayout.js";

const PREVIEW_TEXTURE_KEY = "fake-depth-preview-map";
const PLAYER_MARKER_TEXTURE_KEY = "fake-depth-player-marker";
const PREVIEW_SCALE = 11;
const CAMERA_MOVE_SPEED = 920;
const CAMERA_BOOST_MULTIPLIER = 1.9;
const CAMERA_ZOOM_SPEED = 0.9;
const CAMERA_MIN_ZOOM = 0.65;
const CAMERA_MAX_ZOOM = 1.85;

function getCameraWorldCenter(camera) {
  return {
    x: camera.scrollX + camera.width * 0.5 / camera.zoom,
    y: camera.scrollY + camera.height * 0.5 / camera.zoom,
  };
}

export default class FakeDepthPreviewScene extends Phaser.Scene {
  constructor() {
    super("FakeDepthPreviewScene");
    this.previewMap = null;
    this.buildings = [];
    this.controls = null;
    this.infoText = null;
    this.playerMarker = null;
    this.playerShadow = null;
    this.playerLabel = null;
    this.quadrantGraphics = null;
    this.quadrantLabels = [];
    this.worldWidth = 0;
    this.worldHeight = 0;
    this.demoFocusPoint = { x: 0, y: 0 };
    this.cityLayout = null;
  }

  preload() {
    this.load.image(PREVIEW_TEXTURE_KEY, tiledPreviewUrl);
    this.load.image(PLAYER_MARKER_TEXTURE_KEY, "assets/moto.png");
  }

  create() {
    const previewTexture = this.textures.get(PREVIEW_TEXTURE_KEY);
    const sourceImage = previewTexture?.getSourceImage?.();
    this.cityLayout = createFakeDepthCityLayout(sourceImage, {
      scale: PREVIEW_SCALE,
      seed: 0x17a10,
    });
    this.worldWidth = this.cityLayout.worldWidth;
    this.worldHeight = this.cityLayout.worldHeight;
    this.demoFocusPoint = this.cityLayout.focusPoint || this.cityLayout.midpoint;

    this.add
      .rectangle(
        this.worldWidth * 0.5,
        this.worldHeight * 0.5,
        this.worldWidth,
        this.worldHeight,
        0x27303a
      )
      .setDepth(-60);

    this.previewMap = this.add
      .image(0, 0, PREVIEW_TEXTURE_KEY)
      .setOrigin(0)
      .setScale(PREVIEW_SCALE)
      .setDepth(-50);

    this.buildings = this.cityLayout.buildings.map(
      (config) => new BuildingFakeDepth(this, config)
    );
    this.createQuadrantOverlay();
    this.createPlayerReference();

    this.controls = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      zoomIn: Phaser.Input.Keyboard.KeyCodes.E,
      zoomOut: Phaser.Input.Keyboard.KeyCodes.Q,
      boost: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      reset: Phaser.Input.Keyboard.KeyCodes.R,
    });

    this.infoText = this.add
      .text(28, 24, "", {
        fontFamily: "Consolas, monospace",
        fontSize: "22px",
        color: "#f4f7fb",
        backgroundColor: "rgba(7, 12, 18, 0.72)",
        padding: { x: 14, y: 12 },
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(3000);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
    camera.setZoom(1);
    camera.centerOn(this.demoFocusPoint.x, this.demoFocusPoint.y);

    this.handleResize(this.scale.gameSize);
    this.clampCamera(camera);
    this.refreshInfoText(camera);
    this.updateBuildings(camera);
    this.scale.on("resize", this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.handleResize, this);
      this.buildings.forEach((building) => building.destroy());
      this.buildings = [];
      this.quadrantGraphics?.destroy();
      this.quadrantGraphics = null;
      this.quadrantLabels.forEach((label) => label.destroy());
      this.quadrantLabels = [];
      this.playerShadow?.destroy();
      this.playerMarker?.destroy();
      this.playerLabel?.destroy();
    });
  }

  update(_time, delta) {
    const camera = this.cameras.main;
    this.handleCameraInput(camera, delta);
    this.updateBuildings(camera);
    this.refreshInfoText(camera);
  }

  handleCameraInput(camera, delta) {
    const controls = this.controls;
    if (!controls) return;

    if (Phaser.Input.Keyboard.JustDown(controls.reset)) {
      camera.setZoom(1);
      camera.centerOn(this.demoFocusPoint.x, this.demoFocusPoint.y);
    }

    const axisX =
      Number(controls.right.isDown || controls.d.isDown) -
      Number(controls.left.isDown || controls.a.isDown);
    const axisY =
      Number(controls.down.isDown || controls.s.isDown) -
      Number(controls.up.isDown || controls.w.isDown);

    let moveX = axisX;
    let moveY = axisY;
    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 0.0001) {
      moveX /= moveLength;
      moveY /= moveLength;
    }

    const speedMultiplier = controls.boost.isDown
      ? CAMERA_BOOST_MULTIPLIER
      : 1;
    // El movimiento se compensa con el zoom para que el paneo se sienta estable.
    const moveAmount =
      CAMERA_MOVE_SPEED * speedMultiplier * (delta / 1000) / camera.zoom;

    camera.scrollX += moveX * moveAmount;
    camera.scrollY += moveY * moveAmount;

    const zoomAxis =
      Number(controls.zoomIn.isDown) - Number(controls.zoomOut.isDown);
    if (zoomAxis !== 0) {
      const nextZoom = Phaser.Math.Clamp(
        camera.zoom + zoomAxis * CAMERA_ZOOM_SPEED * (delta / 1000),
        CAMERA_MIN_ZOOM,
        CAMERA_MAX_ZOOM
      );
      camera.setZoom(nextZoom);
    }

    this.clampCamera(camera);
  }

  clampCamera(camera) {
    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;

    camera.scrollX = Phaser.Math.Clamp(
      camera.scrollX,
      0,
      Math.max(0, this.worldWidth - visibleWidth)
    );
    camera.scrollY = Phaser.Math.Clamp(
      camera.scrollY,
      0,
      Math.max(0, this.worldHeight - visibleHeight)
    );
  }

  updateBuildings(camera) {
    this.buildings.forEach((building) => building.update(camera));
  }

  createQuadrantOverlay() {
    this.quadrantGraphics = this.add.graphics().setDepth(-4);
    this.quadrantGraphics.lineStyle(12, 0xffffff, 0.08);
    this.quadrantGraphics.strokeRect(0, 0, this.worldWidth, this.worldHeight);
    this.quadrantGraphics.strokeLineShape(
      new Phaser.Geom.Line(this.worldWidth * 0.5, 0, this.worldWidth * 0.5, this.worldHeight)
    );
    this.quadrantGraphics.strokeLineShape(
      new Phaser.Geom.Line(0, this.worldHeight * 0.5, this.worldWidth, this.worldHeight * 0.5)
    );

    const labelStyle = {
      fontFamily: "Consolas, monospace",
      fontSize: "42px",
      color: "#f5f7fb",
      stroke: "#091018",
      strokeThickness: 8,
    };

    this.quadrantLabels = [
      this.add.text(this.worldWidth * 0.25, this.worldHeight * 0.25, "Quadrant NW", labelStyle),
      this.add.text(this.worldWidth * 0.75, this.worldHeight * 0.25, "Quadrant NE", labelStyle),
      this.add.text(this.worldWidth * 0.25, this.worldHeight * 0.75, "Quadrant SW", labelStyle),
      this.add.text(this.worldWidth * 0.75, this.worldHeight * 0.75, "Quadrant SE", labelStyle),
    ];

    this.quadrantLabels.forEach((label) => {
      label.setOrigin(0.5).setDepth(-3).setAlpha(0.58);
    });
  }

  createPlayerReference() {
    this.playerShadow = this.add
      .ellipse(0, 0, 92, 34, 0x000000, 0.24)
      .setScrollFactor(0)
      .setDepth(3998);

    this.playerMarker = this.add
      .image(0, 0, PLAYER_MARKER_TEXTURE_KEY)
      .setScrollFactor(0)
      .setDepth(3999)
      .setDisplaySize(136, 90)
      .setAlpha(0.94);

    this.playerLabel = this.add
      .text(0, 0, "moto ref", {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#f7fbff",
        backgroundColor: "rgba(7, 12, 18, 0.8)",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4000);
  }

  handleResize(gameSize) {
    const centerX = gameSize.width * 0.5;
    const centerY = gameSize.height * 0.5;

    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
    this.playerShadow?.setPosition(centerX, centerY + 44);
    this.playerMarker?.setPosition(centerX, centerY);
    this.playerLabel?.setPosition(centerX, centerY + 94);
  }

  refreshInfoText(camera) {
    const center = getCameraWorldCenter(camera);
    this.infoText.setText([
      "Fake Depth Preview",
      "Mover camara: WASD o flechas | Acelerar: Shift",
      "Zoom: Q / E | Reset: R",
      "Activa esta escena con ?scene=fake-depth",
      `Moto ref: centro de pantalla = ${center.x.toFixed(0)}, ${center.y.toFixed(0)}`,
      `Footprints reales: ${this.buildings.length} | Tiles estructura: ${this.cityLayout?.structureTileCount || 0}`,
      `Camara: ${center.x.toFixed(0)}, ${center.y.toFixed(0)} | Zoom: ${camera.zoom.toFixed(2)}`,
      "Mapa usado: map.json + map.png | edificios clavados a la grilla del mapa",
      "Base fija = huella logica | Techo = offset dinamico | Lateral = union visual",
    ]);
  }
}
