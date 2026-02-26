export default class DebugHUD {
  constructor(scene) {
    // Guarda referencia de escena.
    this.scene = scene;
    // Acumula tiempo para no refrescar texto cada frame.
    this.accumulator = 0;
    // Margen fijo desde la esquina superior izquierda de pantalla.
    this.anchorPadding = 16;
    // Ajusta resolucion del texto en pantallas de alta densidad.
    const textResolution =
      typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    // Crea texto fijo en pantalla.
    this.text = scene.add.text(16, 16, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "16px",
      color: "#e6e6e6",
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      padding: { x: 10, y: 8 },
    });
    // Aplica resolucion al texto para que se vea nitido.
    this.text.setResolution(textResolution);
    this.text.setOrigin(0, 0);
    this.text.setPosition(this.anchorPadding, this.anchorPadding);

    // Mantiene HUD fijo sin moverse con la camara.
    this.text.setScrollFactor(0);
    // Dibuja HUD por encima de todo.
    this.text.setDepth(1000);
  }

  update(moto, delta, info = {}) {
    // Refuerza anclaje fijo en pantalla.
    this.text.setPosition(this.anchorPadding, this.anchorPadding);
    this.text.setScale(1);

    // Acumula delta del frame.
    this.accumulator += delta;
    // Sale temprano hasta cumplir intervalo de refresco.
    if (this.accumulator < 120) return;
    // Reinicia acumulador.
    this.accumulator = 0;

    // Actualiza lineas de telemetria.
    this.text.setText([
      `Vel: ${moto.speedPxPerSec.toFixed(0)} px/s`,
      `Derrape: ${moto.isDrifting ? "si" : "no"}`,
      `Freno: ${moto.isBraking ? "si" : "no"}`,
      `Mapa: ${info.mapLabel || "N/A"}`,
      info.objective || "Objetivo: N/A",
      info.nextStop || "Siguiente: N/A",
      info.cargo || "Carga: N/A",
      info.health || "Vida: N/A",
      info.mapHint || "1: Abierto | 2: Pista | 3: Reparto | 4: Carrera",
      "Controles: Flechas + Shift + Space",
    ]);
  }
}
