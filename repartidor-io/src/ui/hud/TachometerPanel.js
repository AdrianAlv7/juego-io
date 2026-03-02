import Phaser from "phaser";
import {
  HUD_MAX_SPEED_KMH,
  speedPxPerSecToHudRatio,
  speedPxPerSecToKmh,
} from "../../world/race/utils/telemetry.js";

export default class TachometerPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;

    this.layout = {
      x: 16,
      y: 16,
      width: 320,
      height: 360,
      centerX: 0,
      centerY: 0,
      radius: 98,
    };

    /* ================= GRAPHICS ================= */
    this.baseGraphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.gaugeGraphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth + 1);
    this.needleGraphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth + 2);

    /* ================= TEXT STYLES ================= */
    const titleStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "22px",
      fontStyle: "bold",
      color: "#eaf2ff",
    };

    const bodyStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "20px",
      color: "#cfe2ff",
    };

    /* ================= TEXT NODES ================= */
    this.motoTitle = scene.add.text(0, 0, "MOTO", titleStyle);

    this.speedValueText = scene.add.text(0, 0, "000", {
      ...bodyStyle,
      fontSize: "72px",
      fontStyle: "bold",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.speedUnitText = scene.add.text(0, 0, "km/h", {
      ...bodyStyle,
      fontSize: "20px",
      color: "#8fc9ff",
    }).setOrigin(0.5);

    this.rpmLabelText = scene.add.text(0, 0, "RPM", {
      ...bodyStyle,
      fontSize: "18px",
      color: "#ffc878",
    }).setOrigin(0, 0.5);

    this.rpmValueText = scene.add.text(0, 0, "1000", {
      ...bodyStyle,
      fontSize: "30px",
      fontStyle: "bold",
      color: "#ffd7a2",
    }).setOrigin(0, 0.5);

    this.motoHealthText = scene.add.text(0, 0, "Moto: 100%", {
      ...bodyStyle,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#52d273",
    });

    this.repairText = scene.add.text(0, 0, "", {
      ...bodyStyle,
      fontSize: "18px",
      color: "#ffd27d",
    });

    this.textNodes = [
      this.motoTitle,
      this.speedValueText,
      this.speedUnitText,
      this.rpmLabelText,
      this.rpmValueText,
      this.motoHealthText,
      this.repairText,
    ];

    this.textNodes.forEach((t, i) =>
      t.setScrollFactor(0).setDepth(this.depth + 3 + i)
    );

    this.displayRpm = 1000;
  }

  /* ================= LAYOUT ================= */
  resize(gameSize) {
    this.layout.width = Math.min(320, Math.max(260, gameSize.width * 0.27));
    this.layout.height = 360;
    this.layout.x = gameSize.width - this.layout.width - 16;
    this.layout.y = 16;

    this.layout.centerX = this.layout.x + this.layout.width * 0.5;
    this.layout.centerY = this.layout.y + this.layout.height * 0.72;
    this.layout.radius = Math.min(98, this.layout.width * 0.31);

    this.motoTitle.setPosition(this.layout.x + 18, this.layout.y + 10);
    this.speedValueText.setPosition(this.layout.centerX, this.layout.y + 90);
    this.speedUnitText.setPosition(this.layout.centerX, this.layout.y + 138);

    this.rpmLabelText.setPosition(this.layout.x + 20, this.layout.y + 185);
    this.rpmValueText.setPosition(this.layout.x + 70, this.layout.y + 185);

    this.motoHealthText.setPosition(this.layout.x + 20, this.layout.y + 215);
    this.repairText.setPosition(this.layout.x + 20, this.layout.y + 242);

    this.drawShell();
  }

  /* ================= PANEL ================= */
  drawShell() {
    this.baseGraphics.clear();

    // Sombra
    this.baseGraphics.fillStyle(0x000000, 0.35);
    this.baseGraphics.fillRoundedRect(
      this.layout.x + 4,
      this.layout.y + 6,
      this.layout.width,
      this.layout.height,
      22
    );

    // Fondo
    this.baseGraphics.fillStyle(0x0c1622, 0.94);
    this.baseGraphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      22
    );

    // Bordes
    this.baseGraphics.lineStyle(2, 0x3a6a8f, 1);
    this.baseGraphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      22
    );
  }

  /* ================= UPDATE ================= */
  update(moto, motoInfo = {}) {
    const speedRatio = speedPxPerSecToHudRatio(moto.speedPxPerSec);
    const speedKmh = Math.round(
      Phaser.Math.Clamp(
        speedPxPerSecToKmh(moto.speedPxPerSec),
        0,
        HUD_MAX_SPEED_KMH
      )
    );

    /* ---------- RPM ---------- */
    const idleRpm = 1000;
    const throttleBoost = moto.input?.up ? 240 : 0;
    const rpmTarget = Phaser.Math.Clamp(
      1080 + speedRatio * 9200 + throttleBoost,
      idleRpm,
      12000
    );

    const smoothing = rpmTarget < this.displayRpm ? 0.55 : 0.3;
    this.displayRpm = Phaser.Math.Linear(this.displayRpm, rpmTarget, smoothing);

    const rpm = Math.round(this.displayRpm);

    /* ---------- TEXT ---------- */
    this.speedValueText.setText(String(speedKmh).padStart(3, "0"));
    this.rpmValueText.setText(String(rpm));

    const health = Math.max(0, Math.round(motoInfo.healthPercent ?? 100));
    this.motoHealthText.setText(`Moto: ${health}%`);

    if (health < 30) this.motoHealthText.setColor("#ff4b4b");
    else if (health < 60) this.motoHealthText.setColor("#ffb347");
    else this.motoHealthText.setColor("#52d273");

    if (motoInfo.repairing) {
      const total = motoInfo.repairDurationMs || 1800;
      const left = motoInfo.repairRemainingMs || 0;
      const percent = Math.round((1 - left / total) * 100);
      this.repairText.setText(`Reparando... ${percent}%`);
    } else {
      this.repairText.setText("");
    }

    this.drawGauge(speedRatio);
  }

  /* ================= GAUGE ================= */
  drawGauge(ratio) {
    this.gaugeGraphics.clear();
    this.needleGraphics.clear();

    const cx = this.layout.centerX;
    const cy = this.layout.centerY;
    const r = this.layout.radius;

    const start = Phaser.Math.DegToRad(150);
    const end = Phaser.Math.DegToRad(390);

    // Fondo
    this.gaugeGraphics.lineStyle(18, 0x1e2d3d, 1);
    this.gaugeGraphics.beginPath();
    this.gaugeGraphics.arc(cx, cy, r, start, end);
    this.gaugeGraphics.strokePath();

    // Zonas
    const zones = [
      { t: 0.6, color: 0x64d97a },
      { t: 0.82, color: 0xffb347 },
      { t: 1, color: 0xff4b4b },
    ];

    let last = 0;
    zones.forEach(z => {
      this.gaugeGraphics.lineStyle(14, z.color, 0.95);
      this.gaugeGraphics.beginPath();
      this.gaugeGraphics.arc(
        cx,
        cy,
        r,
        Phaser.Math.Linear(start, end, last),
        Phaser.Math.Linear(start, end, z.t)
      );
      this.gaugeGraphics.strokePath();
      last = z.t;
    });

    /* ---------- NEEDLE ---------- */
    const angle = Phaser.Math.Linear(start, end, ratio);
    const len = r - 16;
    const tipX = cx + Math.cos(angle) * len;
    const tipY = cy + Math.sin(angle) * len;

    // Sombra
    this.needleGraphics.lineStyle(6, 0x000000, 0.35);
    this.needleGraphics.beginPath();
    this.needleGraphics.moveTo(cx + 2, cy + 2);
    this.needleGraphics.lineTo(tipX + 2, tipY + 2);
    this.needleGraphics.strokePath();

    // Aguja
    this.needleGraphics.lineStyle(4, 0xffffff, 1);
    this.needleGraphics.beginPath();
    this.needleGraphics.moveTo(cx, cy);
    this.needleGraphics.lineTo(tipX, tipY);
    this.needleGraphics.strokePath();

    // Centro
    this.needleGraphics.fillStyle(0x0c1622, 1);
    this.needleGraphics.fillCircle(cx, cy, 10);
    this.needleGraphics.fillStyle(0xffffff, 1);
    this.needleGraphics.fillCircle(cx, cy, 4);
  }

  destroy() {
    this.baseGraphics.destroy();
    this.gaugeGraphics.destroy();
    this.needleGraphics.destroy();
    this.textNodes.forEach(t => t.destroy());
  }
}