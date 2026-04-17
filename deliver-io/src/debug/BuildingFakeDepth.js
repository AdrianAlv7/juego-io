import Phaser from "phaser";

// Edificio tecnico para prueba de "top-down con falsa profundidad".
// Solo dibuja shapes: base, lateral y techo.
const DEFAULT_WALL_TEXTURE_KEY = "debug-wall-side";
const DEFAULT_ROOF_TEXTURE_KEY = "debug-roof-top";
const WALL_VISIBILITY_EPSILON = 0.05;
const WALL_FACE_ALPHA = 0.95;
// Si el eje menor es muy chico respecto al mayor, ocultamos la cara secundaria.
// Ejemplo: "frente completo" = solo una cara.
const SECONDARY_FACE_RATIO = 0.42;
const DEFAULT_ROOF_SCALE = 1.08;
const DEFAULT_ROOF_TEXTURE_ALPHA = 0.98;

export default class BuildingFakeDepth {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.x = Number(options.x || 0);
    this.y = Number(options.y || 0);
    this.width = Math.max(20, Number(options.width || 120));
    this.height = Math.max(20, Number(options.height || 90));
    this.fakeHeight = Math.max(4, Number(options.fakeHeight || 32));
    this.parallaxStrength = Phaser.Math.Clamp(
      Number(options.parallaxStrength || 0.18),
      0,
      1
    );
    this.parallaxMultiplier = Math.max(
      0,
      Number(options.parallaxMultiplier ?? 1)
    );
    this.motionLerp = Phaser.Math.Clamp(Number(options.motionLerp ?? 0.16), 0.02, 0.4);
    this.maxOffsetXPx = Math.max(0, Number(options.maxOffsetXPx ?? 2));
    this.maxOffsetYPx = Math.max(0, Number(options.maxOffsetYPx ?? 2));
    this.nearDistanceForFullEffect = Math.max(
      1,
      Number(options.nearDistanceForFullEffect ?? 120)
    );
    this.minEffectStrength = Phaser.Math.Clamp(
      Number(options.minEffectStrength ?? 0.22),
      0,
      1
    );
    this.roofScale = Phaser.Math.Clamp(
      Number(options.roofScale ?? DEFAULT_ROOF_SCALE),
      1,
      1.35
    );
    this.baseColor = Number(options.baseColor ?? 0x67635f);
    this.sideColor = Number(options.sideColor ?? 0x4b4744);
    this.roofColor = Number(options.roofColor ?? 0xc89e6e);
    this.wallTextureKey = String(options.wallTextureKey || DEFAULT_WALL_TEXTURE_KEY);
    this.useWallTexture = Boolean(scene.textures?.exists?.(this.wallTextureKey));
    this.roofTextureKey = String(options.roofTextureKey || DEFAULT_ROOF_TEXTURE_KEY);
    this.roofTextureAlpha = Phaser.Math.Clamp(
      Number(options.roofTextureAlpha ?? DEFAULT_ROOF_TEXTURE_ALPHA),
      0.05,
      1
    );
    this.useRoofTexture = Boolean(scene.textures?.exists?.(this.roofTextureKey));
    this.depthBase = Number(options.depthBase || 2105);
    this.visible = true;
    this.wallFaces = null;

    this.base = scene.add
      .rectangle(this.x, this.y, this.width, this.height, this.baseColor)
      .setOrigin(0.5)
      .setDepth(this.depthBase);
    // Base lateral siempre visible (fallback), incluso cuando hay textura.
    this.side = scene.add.graphics().setDepth(this.depthBase + 1);
    this.roofWidth = this.width * this.roofScale;
    this.roofHeight = this.height * this.roofScale;
    if (this.useRoofTexture) {
      this.roof = scene.add
        .image(this.x, this.y, this.roofTextureKey)
        .setOrigin(0.5)
        .setDisplaySize(this.roofWidth, this.roofHeight)
        .setAlpha(this.roofTextureAlpha)
        .setDepth(this.depthBase + 2);
    } else {
      this.roof = scene.add
        .rectangle(this.x, this.y, this.roofWidth, this.roofHeight, this.roofColor)
        .setOrigin(0.5)
        .setDepth(this.depthBase + 2);
    }
    if (this.useWallTexture) {
      this.wallFaces = {
        left: this.createWallFace(),
        right: this.createWallFace(),
        top: this.createWallFace(),
        bottom: this.createWallFace(),
      };
    }

    this.currentOffsetX = 0;
    this.currentOffsetY = 0;
    this.viewerX = this.x;
    this.viewerY = this.y;
    this.redrawSide();
  }

  createWallFace() {
    const maskGraphics = this.scene.add.graphics().setVisible(false);
    const sprite = this.scene.add
      .image(this.x, this.y, this.wallTextureKey)
      .setOrigin(0, 0)
      .setDepth(this.depthBase + 1.2)
      .setAlpha(WALL_FACE_ALPHA)
      .setVisible(false);
    sprite.setMask(maskGraphics.createGeometryMask());
    return { sprite, maskGraphics };
  }

  getViewpoint(camera) {
    const motoSprite = this.scene?.moto?.sprite || null;
    if (motoSprite && Number.isFinite(motoSprite.x) && Number.isFinite(motoSprite.y)) {
      return { x: motoSprite.x, y: motoSprite.y };
    }
    return {
      x: Number(camera?.midPoint?.x ?? 0),
      y: Number(camera?.midPoint?.y ?? 0),
    };
  }

  getBaseBounds() {
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    return {
      left: this.x - halfW,
      right: this.x + halfW,
      top: this.y - halfH,
      bottom: this.y + halfH,
      width: this.width,
      height: this.height,
    };
  }

  update(camera) {
    if (!this.visible || !camera) return;

    const viewpoint = this.getViewpoint(camera);
    this.viewerX = viewpoint.x;
    this.viewerY = viewpoint.y;
    const dirX = this.x - this.viewerX;
    const dirY = this.y - this.viewerY;
    const length = Math.hypot(dirX, dirY);
    const nx = length > 0.001 ? dirX / length : 0;
    const ny = length > 0.001 ? dirY / length : 0;
    const distToViewer = Math.hypot(this.viewerX - this.x, this.viewerY - this.y);
    const effectStrength = Phaser.Math.Clamp(
      distToViewer / this.nearDistanceForFullEffect,
      this.minEffectStrength,
      1
    );
    const offsetMagnitude =
      this.fakeHeight *
      this.parallaxStrength *
      this.parallaxMultiplier *
      effectStrength;
    // Techo se desplaza "hacia atras" respecto a la moto/camara.
    const targetOffsetX = Phaser.Math.Clamp(
      nx * offsetMagnitude,
      -this.maxOffsetXPx,
      this.maxOffsetXPx
    );
    const targetOffsetY = Phaser.Math.Clamp(
      ny * offsetMagnitude,
      -this.maxOffsetYPx,
      this.maxOffsetYPx
    );

    this.currentOffsetX = Phaser.Math.Linear(
      this.currentOffsetX,
      targetOffsetX,
      this.motionLerp
    );
    this.currentOffsetY = Phaser.Math.Linear(
      this.currentOffsetY,
      targetOffsetY,
      this.motionLerp
    );
    this.currentOffsetX = Phaser.Math.Clamp(
      this.currentOffsetX,
      -this.maxOffsetXPx,
      this.maxOffsetXPx
    );
    this.currentOffsetY = Phaser.Math.Clamp(
      this.currentOffsetY,
      -this.maxOffsetYPx,
      this.maxOffsetYPx
    );

    this.roof.setPosition(
      this.x + this.currentOffsetX,
      this.y + this.currentOffsetY
    );
    this.redrawSide();
  }

  redrawSide() {
    this.side.clear();
    this.side.fillStyle(this.sideColor, 1);

    const b = this.getBaseCorners();
    const r = this.getRoofCorners();
    const visibleFaces = this.getVisibleFaceFlags();

    // Solo dibuja caras visibles segun direccion del offset para conservar look top-down.
    if (visibleFaces.showRight) {
      this.side.fillPoints([b.tr, b.br, r.br, r.tr], true);
    } else if (visibleFaces.showLeft) {
      this.side.fillPoints([b.tl, b.bl, r.bl, r.tl], true);
    }
    if (visibleFaces.showBottom) {
      this.side.fillPoints([b.bl, b.br, r.br, r.bl], true);
    } else if (visibleFaces.showTop) {
      this.side.fillPoints([b.tl, b.tr, r.tr, r.tl], true);
    }

    if (this.useWallTexture && this.wallFaces) {
      this.redrawTexturedWalls(visibleFaces, b, r);
    }
  }

  getBaseCorners() {
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    return {
      tl: { x: this.x - halfW, y: this.y - halfH },
      tr: { x: this.x + halfW, y: this.y - halfH },
      br: { x: this.x + halfW, y: this.y + halfH },
      bl: { x: this.x - halfW, y: this.y + halfH },
    };
  }

  getRoofCorners() {
    const halfW = this.roofWidth * 0.5;
    const halfH = this.roofHeight * 0.5;
    return {
      tl: {
        x: this.x - halfW + this.currentOffsetX,
        y: this.y - halfH + this.currentOffsetY,
      },
      tr: {
        x: this.x + halfW + this.currentOffsetX,
        y: this.y - halfH + this.currentOffsetY,
      },
      br: {
        x: this.x + halfW + this.currentOffsetX,
        y: this.y + halfH + this.currentOffsetY,
      },
      bl: {
        x: this.x - halfW + this.currentOffsetX,
        y: this.y + halfH + this.currentOffsetY,
      },
    };
  }

  getVisibleFaceFlags() {
    const relX = this.viewerX - this.x;
    const relY = this.viewerY - this.y;
    const absX = Math.abs(relX);
    const absY = Math.abs(relY);
    const major = Math.max(absX, absY, 0.0001);
    const minor = Math.min(absX, absY);
    const secondaryAllowed = minor / major >= SECONDARY_FACE_RATIO;
    const xDominant = absX >= absY;
    const showX =
      absX > WALL_VISIBILITY_EPSILON && (secondaryAllowed || xDominant);
    const showY =
      absY > WALL_VISIBILITY_EPSILON && (secondaryAllowed || !xDominant);
    return {
      showRight: showX && relX > 0,
      showLeft: showX && relX < 0,
      showBottom: showY && relY > 0,
      showTop: showY && relY < 0,
    };
  }

  hideAllWallFaces() {
    if (!this.wallFaces) return;
    Object.values(this.wallFaces).forEach((face) => {
      face.sprite.setVisible(false);
      face.maskGraphics.clear();
    });
  }

  redrawTexturedWalls(visibleFaces = this.getVisibleFaceFlags(), b, r) {
    this.hideAllWallFaces();
    if (!this.visible) return;

    if (visibleFaces.showRight) {
      this.applyWallFaceQuad(this.wallFaces.right, [b.tr, b.br, r.br, r.tr]);
    } else if (visibleFaces.showLeft) {
      this.applyWallFaceQuad(this.wallFaces.left, [b.tl, b.bl, r.bl, r.tl]);
    }

    if (visibleFaces.showBottom) {
      this.applyWallFaceQuad(this.wallFaces.bottom, [b.bl, b.br, r.br, r.bl]);
    } else if (visibleFaces.showTop) {
      this.applyWallFaceQuad(this.wallFaces.top, [b.tl, b.tr, r.tr, r.tl]);
    }
  }

  applyWallFaceQuad(face, points) {
    if (!face || !points?.length) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(2, maxX - minX);
    const height = Math.max(2, maxY - minY);

    face.sprite.setVisible(true).setPosition(minX, minY).setDisplaySize(width, height);
    face.maskGraphics.clear();
    face.maskGraphics.fillStyle(0xffffff, 1);
    face.maskGraphics.beginPath();
    face.maskGraphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      face.maskGraphics.lineTo(points[i].x, points[i].y);
    }
    face.maskGraphics.closePath();
    face.maskGraphics.fillPath();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.base.setVisible(this.visible);
    this.side.setVisible(this.visible);
    if (this.wallFaces) {
      if (this.visible) {
        this.redrawSide();
      } else {
        this.hideAllWallFaces();
      }
    }
    this.roof.setVisible(this.visible);
  }

  destroy() {
    this.base?.destroy();
    this.side?.destroy();
    if (this.wallFaces) {
      Object.values(this.wallFaces).forEach((face) => {
        face?.sprite?.clearMask?.();
        face?.sprite?.destroy?.();
        face?.maskGraphics?.destroy?.();
      });
      this.wallFaces = null;
    }
    this.roof?.destroy();
  }
}
