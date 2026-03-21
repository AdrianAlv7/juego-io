const TAU = Math.PI * 2;

export default class TrackMap {
  constructor(scene, options = {}) {
    // Guarda referencia de escena.
    this.scene = scene;

    // Opciones base del mundo.
    const { worldWidth = 6000, worldHeight = 6000 } = options;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Limites fisicos globales.
    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Centro de pista.
    this.centerX = worldWidth / 2;
    this.centerY = worldHeight / 2;

    // Radios base del sistema normalizado de pista.
    this.baseRadiusX = Math.min(worldWidth * 0.27, 1650);
    this.baseRadiusY = Math.min(worldHeight * 0.21, 1250);

    // Medio ancho de carril en coordenada normalizada.
    this.trackHalfWidthNorm = 0.12;

    // Dibuja entorno y pista con curvas.
    this.drawBackground();
    this.drawTrack();

    // Spawn sobre la pista.
    const spawn = this.polarToWorld(0, this.getCenterRadius(0));
    this.spawnPoint = { x: spawn.x, y: spawn.y };

    // Se mantiene para compatibilidad con la interfaz de mapas.
    this.collisionGroup = null;
  }

  drawBackground() {
    // Fondo general tipo pasto.
    const bg = this.scene.add.rectangle(
      this.centerX,
      this.centerY,
      this.worldWidth,
      this.worldHeight,
      0x1c3a20
    );
    bg.setDepth(-30);
  }

  drawTrack() {
    // Graphics para pintar la pista.
    const g = this.scene.add.graphics();
    g.setDepth(-20);

    // Construye anillos exterior/interior con mas curvas.
    const samples = 240;
    const outerLoop = [];
    const innerLoop = [];
    for (let i = 0; i < samples; i += 1) {
      const angle = (i / samples) * TAU;
      outerLoop.push(this.polarToWorld(angle, this.getOuterRadius(angle)));
      innerLoop.push(this.polarToWorld(angle, this.getInnerRadius(angle)));
    }

    // Rellena banda de pista: outer + inner invertido.
    const ringPoints = outerLoop.concat([...innerLoop].reverse());
    g.fillStyle(0x3b3f46, 1);
    g.beginPath();
    g.moveTo(ringPoints[0].x, ringPoints[0].y);
    for (let i = 1; i < ringPoints.length; i += 1) {
      g.lineTo(ringPoints[i].x, ringPoints[i].y);
    }
    g.closePath();
    g.fillPath();

    // Borde externo e interno.
    g.lineStyle(7, 0xf4f4f4, 1);
    this.strokeLoop(g, outerLoop);
    this.strokeLoop(g, innerLoop);

    // Linea de salida simple.
    const startA = this.polarToWorld(0, this.getInnerRadius(0));
    const startB = this.polarToWorld(0, this.getOuterRadius(0));
    g.lineStyle(10, 0xffffff, 1);
    g.lineBetween(startA.x, startA.y, startB.x, startB.y);
  }

  strokeLoop(graphics, points) {
    // Dibuja una polilinea cerrada.
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.strokePath();
  }

  getCenterRadius(angle) {
    // Modula el radio central para crear una pista con mas curvas.
    return (
      1 +
      0.12 * Math.sin(angle * 2) +
      0.06 * Math.sin(angle * 4 + 0.8) +
      0.03 * Math.sin(angle * 7 + 0.4)
    );
  }

  getOuterRadius(angle) {
    // Borde exterior de la banda de pista.
    return this.getCenterRadius(angle) + this.trackHalfWidthNorm;
  }

  getInnerRadius(angle) {
    // Borde interior de la banda de pista.
    return Math.max(this.getCenterRadius(angle) - this.trackHalfWidthNorm, 0.2);
  }

  polarToWorld(angle, radiusNorm) {
    // Convierte coordenada polar normalizada a mundo.
    return {
      x: this.centerX + Math.cos(angle) * this.baseRadiusX * radiusNorm,
      y: this.centerY + Math.sin(angle) * this.baseRadiusY * radiusNorm,
    };
  }

  worldToPolar(x, y) {
    // Convierte coordenada mundo a espacio polar normalizado de pista.
    const nx = (x - this.centerX) / this.baseRadiusX;
    const ny = (y - this.centerY) / this.baseRadiusY;
    const angle = Math.atan2(ny, nx);
    const radiusNorm = Math.hypot(nx, ny);
    return { angle, radiusNorm };
  }

  getSpawnPoint() {
    // Devuelve spawn recomendado.
    return this.spawnPoint;
  }

  getCollisionGroup() {
    // Se mantiene para compatibilidad con GameScene.
    return this.collisionGroup;
  }

  enforcePlayer(moto) {
    // Colision matematica de pista (sin cientos de cuerpos fisicos).
    const polar = this.worldToPolar(moto.sprite.x, moto.sprite.y);
    const outerR = this.getOuterRadius(polar.angle);
    const innerR = this.getInnerRadius(polar.angle);

    // Si esta dentro de carril, no corrige.
    if (polar.radiusNorm <= outerR && polar.radiusNorm >= innerR) {
      return;
    }

    // Recorta posicion al borde valido mas cercano.
    const clampedR = Math.min(Math.max(polar.radiusNorm, innerR), outerR);
    const corrected = this.polarToWorld(polar.angle, clampedR);
    moto.sprite.setPosition(corrected.x, corrected.y);
    moto.sprite.body.updateFromGameObject();

    // Normal aproximada para cancelar la componente de velocidad contra muro.
    let nx = corrected.x - this.centerX;
    let ny = corrected.y - this.centerY;
    const nLen = Math.hypot(nx, ny) || 1;
    nx /= nLen;
    ny /= nLen;

    const normalSpeed = moto.velX * nx + moto.velY * ny;
    const hittingOuterWall = polar.radiusNorm > outerR && normalSpeed > 0;
    const hittingInnerWall = polar.radiusNorm < innerR && normalSpeed < 0;

    if (hittingOuterWall || hittingInnerWall) {
      moto.velX -= normalSpeed * nx;
      moto.velY -= normalSpeed * ny;
    }

    // Pequeña perdida de energia al tocar borde.
    moto.velX *= 0.82;
    moto.velY *= 0.82;
    moto.sprite.body.setVelocity(moto.velX * 60, moto.velY * 60);
  }
}
