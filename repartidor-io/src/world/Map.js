import Phaser from "phaser";

export default class Map {
  constructor(scene) {
    this.scene = scene;

    const WIDTH = 4000;
    const HEIGHT = 4000;

    // límites del mundo
    scene.physics.world.setBounds(0, 0, WIDTH, HEIGHT);

    // fondo
    const bg = scene.add.rectangle(
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH,
      HEIGHT,
      0x2b2b2b
    );
    bg.setDepth(-10);

    // líneas de referencia
    const g = scene.add.graphics();
    g.lineStyle(1, 0x555555);

    for (let x = 0; x <= WIDTH; x += 200) {
      g.lineBetween(x, 0, x, HEIGHT);
    }
    for (let y = 0; y <= HEIGHT; y += 200) {
      g.lineBetween(0, y, WIDTH, y);
    }

    // borde rojo
    g.lineStyle(4, 0xff0000);
    g.strokeRect(0, 0, WIDTH, HEIGHT);

    console.log("🗺️ Mapa grande creado", WIDTH, HEIGHT);
  }
}
