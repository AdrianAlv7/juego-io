export default class DebugHUD {
  constructor(scene) {
    this.scene = scene;
    this.accumulator = 0;

    this.text = scene.add.text(16, 16, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "14px",
      color: "#e6e6e6",
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      padding: { x: 8, y: 6 },
    });

    this.text.setScrollFactor(0);
    this.text.setDepth(1000);
  }

  update(moto, delta) {
    this.accumulator += delta;
    if (this.accumulator < 120) return;
    this.accumulator = 0;

    this.text.setText([
      `Vel: ${moto.speedPxPerSec.toFixed(0)} px/s`,
      `Derrape: ${moto.isDrifting ? "si" : "no"}`,
      `Freno: ${moto.isBraking ? "si" : "no"}`,
      "Controles: Flechas + Shift + Space",
    ]);
  }
}
