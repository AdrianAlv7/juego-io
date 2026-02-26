export default class CityRaceRenderer {
  constructor(scene, options) {
    this.scene = scene;
    this.worldWidth = options.worldWidth;
    this.worldHeight = options.worldHeight;
    this.roadHalfWidth = options.roadHalfWidth;
    this.roadCurves = options.roadCurves;
    this.sampledRoutes = options.sampledRoutes;
    this.drawSamples = options.drawSamples;
  }

  render() {
    this.drawEnvironment();
    this.drawRoads();
  }

  drawEnvironment() {
    const bg = this.scene.add.rectangle(
      this.worldWidth / 2,
      this.worldHeight / 2,
      this.worldWidth,
      this.worldHeight,
      0x0d1117
    );
    bg.setDepth(-50);

    const city = this.scene.add.graphics();
    city.setDepth(-40);
    city.fillStyle(0x1e262f, 1);

    const blockStep = 650;
    for (let y = 300; y <= this.worldHeight; y += blockStep) {
      for (let x = 300; x <= this.worldWidth; x += blockStep) {
        city.fillRoundedRect(x - 180, y - 180, 360, 360, 12);
      }
    }
  }

  drawRoads() {
    const g = this.scene.add.graphics();
    g.setDepth(-25);

    g.lineStyle(this.roadHalfWidth * 2 + 30, 0x333b42, 1);
    this.roadCurves.forEach((curve) => curve.draw(g, this.drawSamples));

    g.lineStyle(this.roadHalfWidth * 2, 0x48515a, 1);
    this.roadCurves.forEach((curve) => curve.draw(g, this.drawSamples));

    g.lineStyle(6, 0xffffff, 0.4);
    this.roadCurves.forEach((curve) => curve.draw(g, this.drawSamples));

    g.lineStyle(4, 0xf4d35e, 0.8);
    this.drawDashedCenterLines(g);
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
}
