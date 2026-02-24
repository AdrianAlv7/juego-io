export default class Map {
  constructor(scene, options = {}) {
    this.scene = scene;

    const {
      worldWidth = 6000,
      worldHeight = 6000,
      gridSize = 200,
      majorGridSize = 1000,
    } = options;

    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    const bg = scene.add.rectangle(
      worldWidth / 2,
      worldHeight / 2,
      worldWidth,
      worldHeight,
      0x2b2b2b
    );
    bg.setDepth(-20);

    const g = scene.add.graphics();
    g.setDepth(-10);

    g.lineStyle(1, 0x3a3a3a, 1);
    for (let x = 0; x <= worldWidth; x += gridSize) {
      g.lineBetween(x, 0, x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += gridSize) {
      g.lineBetween(0, y, worldWidth, y);
    }

    g.lineStyle(2, 0x4a4a4a, 1);
    for (let x = 0; x <= worldWidth; x += majorGridSize) {
      g.lineBetween(x, 0, x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += majorGridSize) {
      g.lineBetween(0, y, worldWidth, y);
    }

    g.lineStyle(3, 0x505050, 1);
    g.strokeRect(0, 0, worldWidth, worldHeight);
  }

  enableCollisions() {}
}
