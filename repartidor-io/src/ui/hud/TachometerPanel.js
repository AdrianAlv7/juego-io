import Phaser from "phaser";
import {
  HUD_MAX_SPEED_KMH,
  speedPxPerSecToHudRatio,
  speedPxPerSecToKmh,
} from "../../world/race/utils/telemetry.js";

function getGaugeColor(ratio) {
  if (ratio >= 0.82) return 0xff4b4b;
  if (ratio >= 0.56) return 0xffb347;
  return 0x64d97a;
}

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

    this.baseGraphics = scene.add.graphics();
    this.baseGraphics.setScrollFactor(0);
    this.baseGraphics.setDepth(this.depth);

    this.gaugeGraphics = scene.add.graphics();
    this.gaugeGraphics.setScrollFactor(0);
    this.gaugeGraphics.setDepth(this.depth + 1);

    this.needleGraphics = scene.add.graphics();
    this.needleGraphics.setScrollFactor(0);
    this.needleGraphics.setDepth(this.depth + 2);

    const titleStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "23px",
      fontStyle: "bold",
      color: "#f2f7ff",
    };
    const bodyStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "20px",
      color: "#d7e1ef",
    };

    this.motoTitle = scene.add.text(0, 0, "MOTO", titleStyle);
    this.speedValueText = scene.add.text(0, 0, "000", {
      ...bodyStyle,
      fontSize: "62px",
      color: "#f7fdff",
      fontStyle: "bold",
    });
    this.speedValueText.setOrigin(0.5, 0.5);
    this.speedUnitText = scene.add.text(0, 0, "km/h", {
      ...bodyStyle,
      fontSize: "22px",
      color: "#9ad0ff",
    });
    this.speedUnitText.setOrigin(0.5, 0.5);

    this.rpmLabelText = scene.add.text(0, 0, "RPM", {
      ...bodyStyle,
      fontSize: "20px",
      color: "#ffddb0",
    });
    this.rpmLabelText.setOrigin(0, 0.5);

    this.rpmValueText = scene.add.text(0, 0, "1000", {
      ...bodyStyle,
      fontSize: "32px",
      color: "#ffd7a2",
      fontStyle: "bold",
    });
    this.rpmValueText.setOrigin(0, 0.5);

    this.motoHealthText = scene.add.text(0, 0, "Moto: 100%", {
      ...bodyStyle,
      fontSize: "22px",
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
    this.textNodes.forEach((node, index) => {
      node.setScrollFactor(0);
      node.setDepth(this.depth + 3 + index);
    });

    this.displayRpm = 1000;
  }

  resize(gameSize) {
    this.layout.width = Math.min(320, Math.max(260, gameSize.width * 0.27));
    this.layout.height = 360;
    this.layout.x = gameSize.width - this.layout.width - 16;
    this.layout.y = 16;
    this.layout.centerX = this.layout.x + this.layout.width * 0.5;
    this.layout.centerY = this.layout.y + this.layout.height * 0.72;
    this.layout.radius = Math.min(98, this.layout.width * 0.31);

    this.motoTitle.setPosition(this.layout.x + 18, this.layout.y + 10);
    this.speedValueText.setPosition(this.layout.centerX, this.layout.y + 80);
    this.speedUnitText.setPosition(this.layout.centerX, this.layout.y + 126);
    this.rpmLabelText.setPosition(this.layout.x + 20, this.layout.y + 172);
    this.rpmValueText.setPosition(this.layout.x + 76, this.layout.y + 172);
    this.motoHealthText.setPosition(this.layout.x + 20, this.layout.y + 204);
    this.repairText.setPosition(this.layout.x + 20, this.layout.y + 232);

    this.drawShell();
  }

  drawShell() {
    this.baseGraphics.clear();
    this.baseGraphics.fillStyle(0x0f1b28, 0.84);
    this.baseGraphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      20
    );
    this.baseGraphics.lineStyle(2, 0x3a5f7d, 1);
    this.baseGraphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      20
    );
  }

  update(moto, motoInfo = {}) {
    const speedRatio = speedPxPerSecToHudRatio(moto.speedPxPerSec);
    const speedKmh = Math.round(
      Phaser.Math.Clamp(speedPxPerSecToKmh(moto.speedPxPerSec), 0, HUD_MAX_SPEED_KMH)
    );

    const throttleBoost = moto.input?.up ? 240 : 0;
    const idleRpm = 1000;
    const rpmTarget = Phaser.Math.Clamp(
      1080 + speedRatio * 9200 + throttleBoost,
      idleRpm,
      12000
    );

    const isStopped = speedKmh <= 1;
    const accelerating = Boolean(moto.input?.up);
    const braking = Boolean(moto.input?.brake || moto.isBraking);

    if (isStopped && !accelerating && !moto.input?.down) {
      this.displayRpm = idleRpm;
    } else {
      const isDecelerating = rpmTarget < this.displayRpm;
      const smoothing = isDecelerating ? (braking ? 0.82 : 0.52) : 0.3;
      this.displayRpm = Phaser.Math.Linear(this.displayRpm, rpmTarget, smoothing);
    }

    const rpm = Math.round(Phaser.Math.Clamp(this.displayRpm, idleRpm, 12000));
    this.speedValueText.setText(String(speedKmh).padStart(3, "0"));
    this.rpmValueText.setText(String(rpm));

    const motoHealthPercent = Math.max(0, Math.round(motoInfo.healthPercent ?? 100));
    this.motoHealthText.setText(`Moto: ${motoHealthPercent}%`);
    this.motoHealthText.setColor(motoInfo.healthColor || "#52d273");

    if (motoInfo.repairing) {
      const repairDurationMs = Math.max(1, Number(motoInfo.repairDurationMs || 1800));
      const remainingMs = Math.max(0, Number(motoInfo.repairRemainingMs || 0));
      const repairedPercent = Math.round(
        Phaser.Math.Clamp(1 - remainingMs / repairDurationMs, 0, 1) * 100
      );
      this.repairText.setText(`Reparando moto... ${repairedPercent}%`);
      this.repairText.setColor("#ffd27d");
    } else {
      this.repairText.setText("");
    }

    this.drawGauge(speedRatio);
  }

  drawGauge(speedRatio) {
    this.gaugeGraphics.clear();
    this.needleGraphics.clear();

    const cx = this.layout.centerX;
    const cy = this.layout.centerY;
    const radius = this.layout.radius;
    const startAngle = Phaser.Math.DegToRad(150);
    const endAngle = Phaser.Math.DegToRad(390);
    const gaugeColor = getGaugeColor(speedRatio);

    this.gaugeGraphics.lineStyle(16, 0x243747, 0.9);
    this.gaugeGraphics.beginPath();
    this.gaugeGraphics.arc(cx, cy, radius, startAngle, endAngle, false);
    this.gaugeGraphics.strokePath();

    this.gaugeGraphics.lineStyle(12, gaugeColor, 0.95);
    this.gaugeGraphics.beginPath();
    this.gaugeGraphics.arc(
      cx,
      cy,
      radius,
      startAngle,
      Phaser.Math.Linear(startAngle, endAngle, speedRatio),
      false
    );
    this.gaugeGraphics.strokePath();

    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      const angle = Phaser.Math.Linear(startAngle, endAngle, t);
      const x1 = cx + Math.cos(angle) * (radius - 14);
      const y1 = cy + Math.sin(angle) * (radius - 14);
      const x2 = cx + Math.cos(angle) * (radius + 4);
      const y2 = cy + Math.sin(angle) * (radius + 4);
      this.gaugeGraphics.lineStyle(2, 0xbfd9ea, 0.9);
      this.gaugeGraphics.beginPath();
      this.gaugeGraphics.moveTo(x1, y1);
      this.gaugeGraphics.lineTo(x2, y2);
      this.gaugeGraphics.strokePath();
    }

    const needleAngle = Phaser.Math.Linear(startAngle, endAngle, speedRatio);
    const needleLength = radius - 18;
    const tipX = cx + Math.cos(needleAngle) * needleLength;
    const tipY = cy + Math.sin(needleAngle) * needleLength;

    this.needleGraphics.lineStyle(4, 0xf8f8f8, 0.95);
    this.needleGraphics.beginPath();
    this.needleGraphics.moveTo(cx, cy);
    this.needleGraphics.lineTo(tipX, tipY);
    this.needleGraphics.strokePath();

    this.needleGraphics.fillStyle(0xeff7ff, 1);
    this.needleGraphics.fillCircle(cx, cy, 7);
  }

  destroy() {
    this.baseGraphics.destroy();
    this.gaugeGraphics.destroy();
    this.needleGraphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
