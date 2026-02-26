export default class RouteGuideSystem {
  constructor(scene) {
    this.scene = scene;
    this.worldGraphics = scene.add.graphics();
    this.worldGraphics.setDepth(22);

    this.uiGraphics = scene.add.graphics();
    this.uiGraphics.setDepth(1090);
    this.uiGraphics.setScrollFactor(0);
  }

  update(moto, target, disabled = false) {
    this.worldGraphics.clear();
    this.uiGraphics.clear();
    if (disabled || !moto || !target) return;

    const cam = this.scene.cameras.main;
    const inView = cam.worldView.contains(target.x, target.y);
    const pulse = 0.62 + 0.38 * Math.sin(this.scene.time.now * 0.008);

    if (inView) {
      this.drawOnScreenBeacon(target.x, target.y, pulse);
      return;
    }

    this.drawOffScreenIndicator(target, cam, pulse);
  }

  drawOnScreenBeacon(x, y, pulse) {
    const ringRadius = 18 + pulse * 10;
    this.worldGraphics.lineStyle(4, 0x57cc99, 0.85);
    this.worldGraphics.strokeCircle(x, y, ringRadius);
    this.worldGraphics.fillStyle(0x57cc99, 0.95);
    this.worldGraphics.fillCircle(x, y, 8 + pulse * 3);
  }

  drawOffScreenIndicator(target, cam, pulse) {
    const width = this.scene.scale.gameSize.width;
    const height = this.scene.scale.gameSize.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const screenTargetX = (target.x - cam.worldView.x) * cam.zoom;
    const screenTargetY = (target.y - cam.worldView.y) * cam.zoom;
    const dx = screenTargetX - centerX;
    const dy = screenTargetY - centerY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;

    const edgePadding = 56;
    const safeHalfWidth = centerX - edgePadding;
    const safeHalfHeight = centerY - edgePadding;
    const tx = dx === 0 ? Number.POSITIVE_INFINITY : safeHalfWidth / Math.abs(dx);
    const ty = dy === 0 ? Number.POSITIVE_INFINITY : safeHalfHeight / Math.abs(dy);
    const t = Math.min(tx, ty);

    const markerX = centerX + dx * t;
    const markerY = centerY + dy * t;
    const angle = Math.atan2(dy, dx);

    const arrowSize = 22 + pulse * 4;
    const backX = markerX - Math.cos(angle) * arrowSize;
    const backY = markerY - Math.sin(angle) * arrowSize;
    const sideOffset = arrowSize * 0.52;
    const leftX = backX + Math.cos(angle + Math.PI / 2) * sideOffset;
    const leftY = backY + Math.sin(angle + Math.PI / 2) * sideOffset;
    const rightX = backX + Math.cos(angle - Math.PI / 2) * sideOffset;
    const rightY = backY + Math.sin(angle - Math.PI / 2) * sideOffset;

    this.uiGraphics.fillStyle(0x57cc99, 0.24);
    this.uiGraphics.fillCircle(markerX, markerY, 24 + pulse * 8);
    this.uiGraphics.fillStyle(0x57cc99, 0.98);
    this.uiGraphics.fillTriangle(markerX, markerY, leftX, leftY, rightX, rightY);
    this.uiGraphics.lineStyle(2, 0xffffff, 0.9);
    this.uiGraphics.strokeTriangle(markerX, markerY, leftX, leftY, rightX, rightY);
  }
}
