export default class Map {
  constructor(scene, options = {}) {
    // Guarda referencia de escena.
    this.scene = scene;

    // Lee opciones con defaults.
    const {
      worldWidth = 6000,
      worldHeight = 6000,
      gridSize = 200,
      majorGridSize = 1000,
    } = options;

    // Expone ancho/alto para posibles usos futuros.
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Define limites fisicos del mundo.
    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Dibuja un rectangulo de fondo para todo el mapa.
    const bg = scene.add.rectangle(
      worldWidth / 2,
      worldHeight / 2,
      worldWidth,
      worldHeight,
      0x242629
    );
    // Manda el fondo detras de todo.
    bg.setDepth(-20);

    // Crea graphics para dibujar grillas y borde.
    const g = scene.add.graphics();
    // Coloca grilla por encima del fondo.
    g.setDepth(-10);

    // Grilla fina.
    g.lineStyle(1, 0x32363b, 1);
    for (let x = 0; x <= worldWidth; x += gridSize) {
      g.lineBetween(x, 0, x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += gridSize) {
      g.lineBetween(0, y, worldWidth, y);
    }

    // Grilla mayor para orientar posicion.
    g.lineStyle(2, 0x454a52, 1);
    for (let x = 0; x <= worldWidth; x += majorGridSize) {
      g.lineBetween(x, 0, x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += majorGridSize) {
      g.lineBetween(0, y, worldWidth, y);
    }

    // Borde del mundo.
    g.lineStyle(3, 0x5a6068, 1);
    g.strokeRect(0, 0, worldWidth, worldHeight);

    // Punto de spawn para el modo mapa abierto.
    this.spawnPoint = {
      x: worldWidth / 2,
      y: worldHeight / 2,
    };

    // Este modo no tiene obstaculos de colision extra.
    this.collisionGroup = null;
  }

  getSpawnPoint() {
    // Devuelve el punto recomendado de inicio del jugador.
    return this.spawnPoint;
  }

  getCollisionGroup() {
    // Devuelve el grupo de cuerpos estaticos del mapa (null si no hay).
    return this.collisionGroup;
  }

  enforcePlayer(_moto) {
    // Mapa abierto: no aplica restricciones extra de pista.
  }
}
