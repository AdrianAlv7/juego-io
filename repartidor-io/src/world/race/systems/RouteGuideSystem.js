export default class RouteGuideSystem {
  constructor(scene) {
    this.scene = scene;
    this.suppressed = false;
    this.worldGraphics = scene.add.graphics();
    this.worldGraphics.setDepth(22);

    this.uiGraphics = scene.add.graphics();
    this.uiGraphics.setDepth(1090);
    this.uiGraphics.setScrollFactor(0);
  }

  setSuppressed(suppressed) {
    this.suppressed = Boolean(suppressed);
    if (this.suppressed) {
      this.worldGraphics.clear();
      this.uiGraphics.clear();
    }
  }

  update(moto, target, disabled = false) {
    this.worldGraphics.clear();
    this.uiGraphics.clear();
    if (this.suppressed || disabled || !moto || !target) return;

    const distance = Math.hypot(target.x - moto.sprite.x, target.y - moto.sprite.y);
    const color = this.getDistanceColor(distance);
    const cam = this.scene.cameras.main;
    const inView = cam.worldView.contains(target.x, target.y);
    const pulse = 0.62 + 0.38 * Math.sin(this.scene.time.now * 0.008);

    if (inView) {
      this.drawOnScreenBeacon(target.x, target.y, pulse, color);
      return;
    }

    this.drawOffScreenIndicator(target, cam, pulse, color);
  }

  getDistanceColor(distancePx) {
    if (distancePx <= 900) return 0x52d273;
    if (distancePx <= 1800) return 0xffd83d;
    if (distancePx <= 3200) return 0xff9f1c;
    return 0xff4d4d;
  }

  drawOnScreenBeacon(x, y, pulse, color) {
    const ringRadius = 28 + pulse * 16;
    this.worldGraphics.lineStyle(8, color, 0.95);
    this.worldGraphics.strokeCircle(x, y, ringRadius);
    this.worldGraphics.lineStyle(3.5, 0xffffff, 0.82);
    this.worldGraphics.strokeCircle(x, y, ringRadius + 12);
    this.worldGraphics.fillStyle(color, 0.3);
    this.worldGraphics.fillCircle(x, y, 28 + pulse * 10);
    this.worldGraphics.fillStyle(color, 1);
    this.worldGraphics.fillCircle(x, y, 14 + pulse * 5);
  }

  drawOffScreenIndicator(target, cam, pulse, color) {
    const width = this.scene.scale.gameSize.width;
    const height = this.scene.scale.gameSize.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const screenTargetX = (target.x - cam.worldView.x) * cam.zoom;
    const screenTargetY = (target.y - cam.worldView.y) * cam.zoom;
    const dx = screenTargetX - centerX;
    const dy = screenTargetY - centerY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;

    const edgePadding = 36;
    const safeHalfWidth = centerX - edgePadding;
    const safeHalfHeight = centerY - edgePadding;
    const tx = dx === 0 ? Number.POSITIVE_INFINITY : safeHalfWidth / Math.abs(dx);
    const ty = dy === 0 ? Number.POSITIVE_INFINITY : safeHalfHeight / Math.abs(dy);
    const t = Math.min(tx, ty);

    const markerX = centerX + dx * t;
    const markerY = centerY + dy * t;
    const angle = Math.atan2(dy, dx);

    const now = this.scene.time.now;
    const wobble = Math.sin(now * 0.01) * 0.02;
    const markerJitter = 0.7 + pulse * 1.1;
    const animatedMarkerX = markerX + Math.cos(now * 0.014 + angle) * markerJitter;
    const animatedMarkerY = markerY + Math.sin(now * 0.014 + angle) * markerJitter;
    const arrowSize = 40 + pulse * 11;
    const arrowAngle = angle + wobble;
    const backX = animatedMarkerX - Math.cos(arrowAngle) * arrowSize;
    const backY = animatedMarkerY - Math.sin(arrowAngle) * arrowSize;
    const sideOffset = arrowSize * 0.6;
    const leftX = backX + Math.cos(arrowAngle + Math.PI / 2) * sideOffset;
    const leftY = backY + Math.sin(arrowAngle + Math.PI / 2) * sideOffset;
    const rightX = backX + Math.cos(arrowAngle - Math.PI / 2) * sideOffset;
    const rightY = backY + Math.sin(arrowAngle - Math.PI / 2) * sideOffset;

    this.uiGraphics.fillStyle(color, 0.18);
    this.uiGraphics.fillCircle(animatedMarkerX, animatedMarkerY, 50 + pulse * 18);
    this.uiGraphics.fillStyle(color, 0.28);
    this.uiGraphics.fillCircle(animatedMarkerX, animatedMarkerY, 34 + pulse * 12);
    this.uiGraphics.fillStyle(color, 1);
    this.uiGraphics.fillTriangle(
      animatedMarkerX,
      animatedMarkerY,
      leftX,
      leftY,
      rightX,
      rightY
    );
    this.uiGraphics.lineStyle(3.8, 0xffffff, 0.96);
    this.uiGraphics.strokeTriangle(
      animatedMarkerX,
      animatedMarkerY,
      leftX,
      leftY,
      rightX,
      rightY
    );

    const tailLen = arrowSize * 1.25;
    const tailX = animatedMarkerX - Math.cos(arrowAngle) * tailLen;
    const tailY = animatedMarkerY - Math.sin(arrowAngle) * tailLen;
    this.uiGraphics.lineStyle(4.5, color, 0.8);
    this.uiGraphics.beginPath();
    this.uiGraphics.moveTo(animatedMarkerX, animatedMarkerY);
    this.uiGraphics.lineTo(tailX, tailY);
    this.uiGraphics.strokePath();
  }
}
