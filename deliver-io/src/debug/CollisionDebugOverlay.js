import Phaser from "phaser";

const ROAD_MASK_COLOR = Object.freeze({
  r: 95,
  g: 87,
  b: 79,
  tolerance: 6,
  minAlpha: 220,
});

function isRoadMaskPixel(maskData, index) {
  const alpha = maskData[index + 3];
  if (alpha < ROAD_MASK_COLOR.minAlpha) return false;

  const r = maskData[index];
  const g = maskData[index + 1];
  const b = maskData[index + 2];

  return (
    Math.abs(r - ROAD_MASK_COLOR.r) <= ROAD_MASK_COLOR.tolerance &&
    Math.abs(g - ROAD_MASK_COLOR.g) <= ROAD_MASK_COLOR.tolerance &&
    Math.abs(b - ROAD_MASK_COLOR.b) <= ROAD_MASK_COLOR.tolerance
  );
}

function strokeSegment(graphics, segment) {
  graphics.beginPath();
  graphics.moveTo(segment.ax, segment.ay);
  graphics.lineTo(segment.bx, segment.by);
  graphics.strokePath();
}

export default class CollisionDebugOverlay {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.enabled = Boolean(options.enabled);
    this.toggleKey = options.toggleKey || null;
    this.map = null;
    this.moto = null;
    this.textureKey = "";
    this.staticImage = null;
    this.staticGraphics = null;

    this.dynamicGraphics = scene.add.graphics().setDepth(2109);
    this.dynamicGraphics.setScrollFactor(1);
    this.dynamicGraphics.setVisible(this.enabled);
  }

  setToggleKey(key) {
    this.toggleKey = key || null;
  }

  attach(map, moto = null) {
    this.map = map || null;
    this.moto = moto || this.moto;
    this.rebuildStaticLayer();
    this.applyVisibility();
  }

  setMoto(moto) {
    this.moto = moto || null;
  }

  clearMap() {
    this.map = null;
    this.moto = null;
    this.destroyStaticLayer();
    this.dynamicGraphics?.clear();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.applyVisibility();
    return this.enabled;
  }

  applyVisibility() {
    this.staticImage?.setVisible(this.enabled);
    this.staticGraphics?.setVisible(this.enabled);
    this.dynamicGraphics?.setVisible(this.enabled);
  }

  update() {
    if (this.toggleKey && Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
      this.toggle();
    }

    if (!this.enabled || !this.map) {
      this.dynamicGraphics?.clear();
      return;
    }

    this.drawDynamicLayer();
  }

  drawDynamicLayer() {
    const g = this.dynamicGraphics;
    if (!g) return;
    g.clear();

    if (this.map?.worldWidth && this.map?.worldHeight) {
      g.lineStyle(2, 0xd7e8ff, 0.22);
      g.strokeRect(0, 0, this.map.worldWidth, this.map.worldHeight);
    }

    const trainRect = this.map?.activeTrainEvent?.block?.rect;
    if (trainRect) {
      g.fillStyle(0xff5f5f, 0.16);
      g.fillRect(
        trainRect.left,
        trainRect.top,
        trainRect.width,
        trainRect.height
      );
      g.lineStyle(3, 0xffb0a8, 0.9);
      g.strokeRect(
        trainRect.left,
        trainRect.top,
        trainRect.width,
        trainRect.height
      );
    }

    const body = this.moto?.sprite?.body;
    if (!body) return;

    const centerX = Number(body?.center?.x ?? this.moto?.sprite?.x ?? 0);
    const centerY = Number(body?.center?.y ?? this.moto?.sprite?.y ?? 0);
    if (body?.isCircle && Number.isFinite(body?.radius)) {
      g.lineStyle(3, 0x3de6ff, 0.95);
      g.strokeCircle(centerX, centerY, Number(body.radius));
    } else {
      g.lineStyle(3, 0x3de6ff, 0.95);
      g.strokeRect(
        Number(body.x || 0),
        Number(body.y || 0),
        Number(body.width || 0),
        Number(body.height || 0)
      );
    }
  }

  rebuildStaticLayer() {
    this.destroyStaticLayer();
    if (!this.map) return;

    const hasMask =
      this.map?.collisionMask &&
      Number(this.map?.collisionMask?.width || 0) > 0 &&
      Number(this.map?.collisionMask?.height || 0) > 0 &&
      this.map?.preview;
    if (hasMask) {
      this.buildTiledMaskLayer();
      return;
    }

    const segments = this.map?.collision?.segments;
    if (Array.isArray(segments) && segments.length > 0) {
      this.buildRoadSegmentsLayer(segments);
    }
  }

  buildTiledMaskLayer() {
    const mask = this.map?.collisionMask;
    const sourceData = mask?.data;
    if (!mask || !sourceData) return;

    const textureKey = `debug-collision-mask-${Date.now()}-${Math.floor(
      Math.random() * 100000
    )}`;
    const canvasTexture = this.scene.textures.createCanvas(
      textureKey,
      mask.width,
      mask.height
    );
    if (!canvasTexture) return;

    const context = canvasTexture.getContext();
    const imageData = context.createImageData(mask.width, mask.height);
    const output = imageData.data;

    for (let i = 0; i < sourceData.length; i += 4) {
      if (isRoadMaskPixel(sourceData, i)) continue;
      output[i] = 255;
      output[i + 1] = 78;
      output[i + 2] = 78;
      output[i + 3] = 138;
    }

    context.putImageData(imageData, 0, 0);
    canvasTexture.refresh();

    this.textureKey = textureKey;
    this.staticImage = this.scene.add
      .image(0, 0, textureKey)
      .setOrigin(0, 0)
      .setScale(
        Number(this.map.preview?.scaleX || 1),
        Number(this.map.preview?.scaleY || this.map.preview?.scaleX || 1)
      )
      .setScrollFactor(1)
      .setDepth(2104);
  }

  buildRoadSegmentsLayer(segments) {
    const halfWidth = Number(this.map?.collision?.collisionHalfWidth || 0);
    const g = this.scene.add.graphics().setDepth(2104);
    g.setScrollFactor(1);

    if (halfWidth > 0) {
      g.lineStyle(Math.max(2, halfWidth * 2), 0xff5757, 0.12);
      for (const segment of segments) {
        strokeSegment(g, segment);
      }
    }

    g.lineStyle(2, 0xffb5b5, 0.62);
    for (const segment of segments) {
      strokeSegment(g, segment);
    }

    this.staticGraphics = g;
  }

  destroyStaticLayer() {
    this.staticImage?.destroy();
    this.staticImage = null;
    this.staticGraphics?.destroy();
    this.staticGraphics = null;

    if (this.textureKey && this.scene?.textures?.exists?.(this.textureKey)) {
      this.scene.textures.remove(this.textureKey);
    }
    this.textureKey = "";
  }

  destroy() {
    this.destroyStaticLayer();
    this.dynamicGraphics?.destroy();
    this.dynamicGraphics = null;
    this.map = null;
    this.moto = null;
    this.toggleKey = null;
  }
}
