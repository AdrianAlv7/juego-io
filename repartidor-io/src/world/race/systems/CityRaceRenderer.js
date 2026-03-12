export default class CityRaceRenderer {
  constructor(scene, options) {
    this.scene = scene;
    this.worldWidth = options.worldWidth;
    this.worldHeight = options.worldHeight;
    this.roadHalfWidth = options.roadHalfWidth;
    this.roadCurves = options.roadCurves;
    this.sampledRoutes = options.sampledRoutes;
    this.drawSamples = options.drawSamples;
    this.background = null;
    this.cityGraphics = null;
    this.roadGraphics = null;
  }

  render() {
    this.drawEnvironment();
    this.drawRoads();
  }

  drawEnvironment() {
    this.background = this.scene.add.rectangle(
      this.worldWidth / 2,
      this.worldHeight / 2,
      this.worldWidth,
      this.worldHeight,
      0x0d1117
    );
    this.background.setDepth(-50);

    this.cityGraphics = this.scene.add.graphics();
    this.cityGraphics.setDepth(-40);
    this.cityGraphics.fillStyle(0x1e262f, 1);

    const blockStep = 650;
    for (let y = 300; y <= this.worldHeight; y += blockStep) {
      for (let x = 300; x <= this.worldWidth; x += blockStep) {
        this.cityGraphics.fillRoundedRect(x - 180, y - 180, 360, 360, 12);
      }
    }
  }

  drawRoads() {
    this.roadGraphics = this.scene.add.graphics();
    this.roadGraphics.setDepth(-25);

    this.roadGraphics.lineStyle(this.roadHalfWidth * 2 + 30, 0x333b42, 1);
    this.roadCurves.forEach((curve) => curve.draw(this.roadGraphics, this.drawSamples));

    this.roadGraphics.lineStyle(this.roadHalfWidth * 2, 0x48515a, 1);
    this.roadCurves.forEach((curve) => curve.draw(this.roadGraphics, this.drawSamples));

    this.roadGraphics.lineStyle(6, 0xffffff, 0.4);
    this.roadCurves.forEach((curve) => curve.draw(this.roadGraphics, this.drawSamples));

    this.roadGraphics.lineStyle(4, 0xf4d35e, 0.8);
    this.drawDashedCenterLines(this.roadGraphics);
  }

  drawDashedCenterLines(graphics) {
    const dashLength = 80;
    const gapLength = 60;

    for (const route of this.sampledRoutes) {
      for (let i = 0; i < route.length - 1; i += 1) {
        const a = route[i];
        const b = route[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segmentLength = Math.hypot(dx, dy);
        if (segmentLength < 1) continue;

        const ux = dx / segmentLength;
        const uy = dy / segmentLength;
        let cursor = 0;
        let drawDash = true;

        while (cursor < segmentLength) {
          const step = Math.min(
            drawDash ? dashLength : gapLength,
            segmentLength - cursor
          );
          if (drawDash) {
            const x1 = a.x + ux * cursor;
            const y1 = a.y + uy * cursor;
            const x2 = a.x + ux * (cursor + step);
            const y2 = a.y + uy * (cursor + step);
            graphics.lineBetween(x1, y1, x2, y2);
          }
          cursor += step;
          drawDash = !drawDash;
        }
      }
    }
  }

  destroy() {
    this.background?.destroy();
    this.cityGraphics?.destroy();
    this.roadGraphics?.destroy();
    this.background = null;
    this.cityGraphics = null;
    this.roadGraphics = null;
  }
}
