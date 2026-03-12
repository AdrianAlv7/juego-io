// Panel de minimapa del HUD.
// Dibuja una vista compacta del mapa activo y la posicion del jugador local/remotos.
export default class MiniMapPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = Number(options.depth || 1320);
    this.margin = Number(options.margin || 16);
    this.visible = true;
    this.mapData = null;
    this.playerState = {
      localPlayer: null,
      remotePlayers: [],
      objective: null,
    };

    this.layout = {
      x: 0,
      y: 0,
      width: 220,
      height: 248,
      padding: 12,
      headerHeight: 30,
      innerX: 0,
      innerY: 0,
      innerWidth: 0,
      innerHeight: 0,
    };
    this.mapViewport = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };

    this.frameGraphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.mapGraphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth + 1);
    this.markerGraphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth + 3);
    this.previewImage = scene.add
      .image(0, 0, "__WHITE")
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(this.depth + 2)
      .setVisible(false);
    this.titleText = scene.add
      .text(0, 0, "Mini mapa", {
        fontFamily: "Consolas, monospace",
        fontSize: "16px",
        color: "#f0f6ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(this.depth + 4);

    this.objects = [
      this.frameGraphics,
      this.mapGraphics,
      this.markerGraphics,
      this.previewImage,
      this.titleText,
    ];
    this.objects.forEach((node) => {
      node.__isHudObject = true;
    });

    this.handleResize = this.handleResize.bind(this);
    scene.scale.on("resize", this.handleResize, this);
    this.handleResize(scene.scale.gameSize);
    this.setVisible(true);
  }

  handleResize(gameSize) {
    const baseSize = Math.min(
      260,
      Math.max(180, Math.min(gameSize.width, gameSize.height) * 0.24)
    );

    this.layout.width = baseSize;
    this.layout.height = baseSize + 30;
    this.layout.x = gameSize.width - this.layout.width - this.margin;
    this.layout.y = this.margin;
    this.layout.innerX = this.layout.x + this.layout.padding;
    this.layout.innerY =
      this.layout.y + this.layout.headerHeight + this.layout.padding - 4;
    this.layout.innerWidth = this.layout.width - this.layout.padding * 2;
    this.layout.innerHeight =
      this.layout.height - this.layout.headerHeight - this.layout.padding * 2 + 4;

    this.titleText.setPosition(this.layout.x + 14, this.layout.y + 9);
    this.drawStaticMap();
    this.drawMarkers();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.objects.forEach((node) => node.setVisible(this.visible));
    if (!this.visible) {
      this.previewImage.setVisible(false);
    }
    this.drawStaticMap();
    this.drawMarkers();
  }

  setMapData(mapData = null) {
    this.mapData = mapData || null;
    this.drawStaticMap();
    this.drawMarkers();
  }

  update(playerState = {}) {
    this.playerState = {
      localPlayer: playerState.localPlayer || null,
      remotePlayers: Array.isArray(playerState.remotePlayers)
        ? playerState.remotePlayers
        : [],
      objective: playerState.objective || null,
    };
    this.drawMarkers();
  }

  drawStaticMap() {
    this.frameGraphics.clear();
    this.mapGraphics.clear();

    if (!this.visible) return;

    this.frameGraphics.fillStyle(0x081018, 0.92);
    this.frameGraphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      18
    );
    this.frameGraphics.lineStyle(2, 0xffffff, 0.14);
    this.frameGraphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      18
    );

    this.frameGraphics.fillStyle(0x0d1721, 0.96);
    this.frameGraphics.fillRoundedRect(
      this.layout.innerX,
      this.layout.innerY,
      this.layout.innerWidth,
      this.layout.innerHeight,
      12
    );
    this.frameGraphics.lineStyle(1, 0xffffff, 0.12);
    this.frameGraphics.strokeRoundedRect(
      this.layout.innerX,
      this.layout.innerY,
      this.layout.innerWidth,
      this.layout.innerHeight,
      12
    );

    if (!this.mapData) {
      this.mapViewport = {
        x: this.layout.innerX,
        y: this.layout.innerY,
        width: this.layout.innerWidth,
        height: this.layout.innerHeight,
      };
      this.previewImage.setVisible(false);
      return;
    }

    this.mapViewport = this.getMapViewport();

    if (this.mapData.type === "image" && this.mapData.textureKey) {
      this.previewImage.setTexture(this.mapData.textureKey);
      this.previewImage.setDisplaySize(
        this.mapViewport.width,
        this.mapViewport.height
      );
      this.previewImage.setPosition(
        this.mapViewport.x + this.mapViewport.width / 2,
        this.mapViewport.y + this.mapViewport.height / 2
      );
      this.previewImage.setAlpha(0.96);
      this.previewImage.setVisible(this.visible);
      return;
    }

    this.previewImage.setVisible(false);

    if (this.mapData.type !== "paths" || !Array.isArray(this.mapData.paths)) {
      return;
    }

    this.mapGraphics.lineStyle(
      2,
      this.mapData.pathColor ?? 0xf2f4f8,
      this.mapData.pathAlpha ?? 0.9
    );

    for (const path of this.mapData.paths) {
      if (!Array.isArray(path) || path.length < 2) continue;

      this.mapGraphics.beginPath();
      const start = this.worldToMinimapPoint(path[0].x, path[0].y);
      this.mapGraphics.moveTo(start.x, start.y);
      for (let index = 1; index < path.length; index += 1) {
        const point = this.worldToMinimapPoint(path[index].x, path[index].y);
        this.mapGraphics.lineTo(point.x, point.y);
      }
      this.mapGraphics.strokePath();
    }
  }

  worldToMinimapPoint(x, y) {
    const worldWidth = Math.max(1, Number(this.mapData?.worldWidth || 1));
    const worldHeight = Math.max(1, Number(this.mapData?.worldHeight || 1));
    const normalizedX = Math.min(Math.max(Number(x || 0) / worldWidth, 0), 1);
    const normalizedY = Math.min(Math.max(Number(y || 0) / worldHeight, 0), 1);

    return {
      x: this.mapViewport.x + normalizedX * this.mapViewport.width,
      y: this.mapViewport.y + normalizedY * this.mapViewport.height,
    };
  }

  getMapViewport() {
    if (!this.mapData) {
      return {
        x: this.layout.innerX,
        y: this.layout.innerY,
        width: this.layout.innerWidth,
        height: this.layout.innerHeight,
      };
    }

    const worldWidth = Math.max(1, Number(this.mapData.worldWidth || 1));
    const worldHeight = Math.max(1, Number(this.mapData.worldHeight || 1));
    const scale = Math.min(
      this.layout.innerWidth / worldWidth,
      this.layout.innerHeight / worldHeight
    );
    const width = worldWidth * scale;
    const height = worldHeight * scale;

    return {
      x: this.layout.innerX + (this.layout.innerWidth - width) / 2,
      y: this.layout.innerY + (this.layout.innerHeight - height) / 2,
      width,
      height,
    };
  }

  drawMarker(player, radius, fillColor, strokeColor) {
    if (!player) return;

    const point = this.worldToMinimapPoint(player.x, player.y);
    this.markerGraphics.fillStyle(fillColor, 0.98);
    this.markerGraphics.fillCircle(point.x, point.y, radius);
    this.markerGraphics.lineStyle(2, strokeColor, 0.95);
    this.markerGraphics.strokeCircle(point.x, point.y, radius);

    if (!Number.isFinite(player.angle)) return;

    const tipLength = radius + 7;
    const tipX = point.x + Math.cos(player.angle) * tipLength;
    const tipY = point.y + Math.sin(player.angle) * tipLength;
    this.markerGraphics.lineStyle(2, strokeColor, 0.85);
    this.markerGraphics.beginPath();
    this.markerGraphics.moveTo(point.x, point.y);
    this.markerGraphics.lineTo(tipX, tipY);
    this.markerGraphics.strokePath();
  }

  drawObjective(objective) {
    if (!objective) return;

    const point = this.worldToMinimapPoint(objective.x, objective.y);
    const pulse = 0.72 + 0.28 * Math.sin(this.scene.time.now * 0.012);
    const accentColor = Number.isFinite(objective.color) ? objective.color : 0xffd166;
    const outerRadius = objective.kind === "return" ? 8 : 7;
    const innerRadius = objective.kind === "pickup" ? 3 : 2.5;

    this.markerGraphics.lineStyle(2, accentColor, 0.95);
    this.markerGraphics.strokeCircle(point.x, point.y, outerRadius + pulse * 2);
    this.markerGraphics.fillStyle(accentColor, 0.88);
    this.markerGraphics.fillCircle(point.x, point.y, innerRadius + pulse * 0.6);
    this.markerGraphics.lineStyle(1, 0x081018, 0.75);
    this.markerGraphics.strokeCircle(point.x, point.y, innerRadius + pulse * 0.6);
  }

  drawMarkers() {
    this.markerGraphics.clear();
    if (!this.visible || !this.mapData) return;

    if (this.playerState.objective) {
      this.drawObjective(this.playerState.objective);
    }

    const remotePlayers = Array.isArray(this.playerState.remotePlayers)
      ? this.playerState.remotePlayers
      : [];

    for (const remotePlayer of remotePlayers) {
      this.drawMarker(
        remotePlayer,
        4,
        remotePlayer.color ?? 0xff8c6b,
        0x081018
      );
    }

    if (this.playerState.localPlayer) {
      this.drawMarker(this.playerState.localPlayer, 5, 0xf7f5d7, 0x2ed4ff);
    }
  }

  getObjects() {
    return this.objects;
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    this.objects.forEach((node) => node.destroy());
    this.objects = [];
  }
}
