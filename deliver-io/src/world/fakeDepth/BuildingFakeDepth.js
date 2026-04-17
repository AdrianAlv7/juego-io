import Phaser from "phaser";

const DEFAULT_DIRECTION = Object.freeze({ x: -0.68, y: -0.74 });
const MIN_OFFSET_RATIO = 0.18;
const SIDE_FACE_EPSILON = 0.35;

function clampChannel(value) {
  return Phaser.Math.Clamp(Math.round(value), 0, 255);
}

function multiplyColor(color, factor) {
  const source = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(
    clampChannel(source.red * factor),
    clampChannel(source.green * factor),
    clampChannel(source.blue * factor)
  );
}

function createQuad(points) {
  return points.map(({ x, y }) => new Phaser.Geom.Point(x, y));
}

function getCameraWorldCenter(camera) {
  return {
    x: camera.scrollX + camera.width * 0.5 / camera.zoom,
    y: camera.scrollY + camera.height * 0.5 / camera.zoom,
  };
}

export default class BuildingFakeDepth {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.x = Number(config.x) || 0;
    this.y = Number(config.y) || 0;
    this.width = Math.max(8, Number(config.width) || 96);
    this.height = Math.max(8, Number(config.height) || 96);
    this.fakeHeight = Math.max(0, Number(config.fakeHeight) || 80);
    this.baseColor = Number(config.baseColor ?? 0x7b8288);
    this.sideColor = Number(config.sideColor ?? 0x545b61);
    this.roofColor = Number(config.roofColor ?? 0xd88f52);
    this.parallaxStrength = Phaser.Math.Clamp(
      Number(config.parallaxStrength ?? 0.22),
      0,
      1
    );

    this.footprint = new Phaser.Geom.Rectangle(
      this.x,
      this.y,
      this.width,
      this.height
    );

    const baseDepth = Number(config.depth ?? this.y + this.height);
    this.lastDirection = { ...DEFAULT_DIRECTION };
    this.currentRoofOffset = { x: 0, y: 0 };

    this.base = scene.add
      .rectangle(this.x, this.y, this.width, this.height, this.baseColor)
      .setOrigin(0)
      .setDepth(baseDepth)
      .setStrokeStyle(3, multiplyColor(this.baseColor, 0.64), 1);

    this.side = scene.add.graphics().setDepth(baseDepth + 1);

    this.roof = scene.add
      .rectangle(this.x, this.y, this.width, this.height, this.roofColor)
      .setOrigin(0)
      .setDepth(baseDepth + 2)
      .setStrokeStyle(3, multiplyColor(this.roofColor, 0.58), 1);
  }

  getFootprintBounds() {
    return this.footprint.clone();
  }

  getRoofOffset() {
    return { ...this.currentRoofOffset };
  }

  update(camera = this.scene.cameras.main) {
    if (!camera) return;

    const offset = this.calculateRoofOffset(camera);
    this.currentRoofOffset = offset;
    this.drawSide(offset);
    this.roof.setPosition(this.x + offset.x, this.y + offset.y);
  }

  calculateRoofOffset(camera) {
    const center = getCameraWorldCenter(camera);
    const footprintCenterX = this.x + this.width * 0.5;
    const footprintCenterY = this.y + this.height * 0.5;
    const relativeX = footprintCenterX - center.x;
    const relativeY = footprintCenterY - center.y;
    const distance = Math.hypot(relativeX, relativeY);

    let directionX = relativeX;
    let directionY = relativeY;
    let safeDistance = distance;

    if (safeDistance < 0.0001) {
      directionX = this.lastDirection.x;
      directionY = this.lastDirection.y;
      safeDistance = Math.hypot(directionX, directionY);
    }

    directionX /= safeDistance;
    directionY /= safeDistance;
    this.lastDirection = { x: directionX, y: directionY };

    // Mantiene una separacion minima para que base, lateral y techo sigan legibles.
    const visibleWorldSize =
      Math.max(camera.width, camera.height) / Math.max(0.001, camera.zoom);
    const influenceRadius = Math.max(1, visibleWorldSize * 0.5);
    const distanceRatio = Phaser.Math.Clamp(distance / influenceRadius, 0, 1);
    const offsetAmount =
      this.fakeHeight *
      this.parallaxStrength *
      Phaser.Math.Linear(MIN_OFFSET_RATIO, 1, distanceRatio);

    return {
      x: directionX * offsetAmount,
      y: directionY * offsetAmount,
    };
  }

  drawSide(offset) {
    const baseLeft = this.x;
    const baseRight = this.x + this.width;
    const baseTop = this.y;
    const baseBottom = this.y + this.height;

    const roofLeft = baseLeft + offset.x;
    const roofRight = baseRight + offset.x;
    const roofTop = baseTop + offset.y;
    const roofBottom = baseBottom + offset.y;

    this.side.clear();
    this.side.fillStyle(this.sideColor, 1);
    this.side.lineStyle(2, multiplyColor(this.sideColor, 0.52), 0.96);

    // Dibuja solo las caras que quedan expuestas entre la base fija y el techo desplazado.
    if (offset.x > SIDE_FACE_EPSILON) {
      this.drawFace(
        createQuad([
          { x: baseLeft, y: baseTop },
          { x: baseLeft, y: baseBottom },
          { x: roofLeft, y: roofBottom },
          { x: roofLeft, y: roofTop },
        ])
      );
    } else if (offset.x < -SIDE_FACE_EPSILON) {
      this.drawFace(
        createQuad([
          { x: baseRight, y: baseTop },
          { x: roofRight, y: roofTop },
          { x: roofRight, y: roofBottom },
          { x: baseRight, y: baseBottom },
        ])
      );
    }

    if (offset.y > SIDE_FACE_EPSILON) {
      this.drawFace(
        createQuad([
          { x: baseLeft, y: baseTop },
          { x: roofLeft, y: roofTop },
          { x: roofRight, y: roofTop },
          { x: baseRight, y: baseTop },
        ])
      );
    } else if (offset.y < -SIDE_FACE_EPSILON) {
      this.drawFace(
        createQuad([
          { x: baseLeft, y: baseBottom },
          { x: baseRight, y: baseBottom },
          { x: roofRight, y: roofBottom },
          { x: roofLeft, y: roofBottom },
        ])
      );
    }
  }

  drawFace(points) {
    this.side.fillPoints(points, true);
    this.side.strokePoints(points, true, true);
  }

  destroy() {
    this.base?.destroy();
    this.side?.destroy();
    this.roof?.destroy();
  }
}
