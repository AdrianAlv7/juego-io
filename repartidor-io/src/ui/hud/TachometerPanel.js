import Phaser from "phaser";
import {
  HUD_MAX_SPEED_KMH,
  speedPxPerSecToHudRatio,
  speedPxPerSecToKmh,
} from "../../world/race/utils/telemetry.js";

const RPM_ACCEL_RESPONSE = 12;
const RPM_BRAKE_RESPONSE = 26;

export default class TachometerPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;
    this.margin = options.margin ?? 16;

    this.layout = {
      x: 0,
      y: 0,
      width: 360,
      height: 360,
      centerX: 0,
      centerY: 0,
      radius: 112,
    };

    this.staticGraphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.needleGraphics = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    const titleStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#eaf2ff",
    };
    const bodyStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "22px",
      color: "#cfe2ff",
    };

    this.motoTitle = scene.add.text(0, 0, "Taco", titleStyle).setOrigin(0.5);
    this.speedValueText = scene.add
      .text(0, 0, "000", {
        ...bodyStyle,
        fontSize: "84px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.speedUnitText = scene.add
      .text(0, 0, "km/h", {
        ...bodyStyle,
        fontSize: "24px",
        color: "#8fc9ff",
      })
      .setOrigin(0.5, 0);
    this.rpmLabelText = scene.add
      .text(0, 0, "RPM", {
        ...bodyStyle,
        fontSize: "20px",
        color: "#ffc878",
      })
      .setOrigin(1, 0.5);
    this.rpmValueText = scene.add
      .text(0, 0, "1000", {
        ...bodyStyle,
        fontSize: "40px",
        fontStyle: "bold",
        color: "#ffd7a2",
      })
      .setOrigin(0, 0.5);
    this.motoHealthText = scene.add
      .text(0, 0, "Salud: 100%", {
        ...bodyStyle,
        fontSize: "24px",
        fontStyle: "bold",
        color: "#52d273",
      })
      .setOrigin(0.5);
    this.repairText = scene.add
      .text(0, 0, "", {
        ...bodyStyle,
        fontSize: "20px",
        color: "#ffd27d",
      })
      .setOrigin(0.5);

    this.textNodes = [
      this.motoTitle,
      this.speedValueText,
      this.speedUnitText,
      this.rpmLabelText,
      this.rpmValueText,
      this.motoHealthText,
      this.repairText,
    ];
    this.textNodes.forEach((textNode, i) =>
      textNode.setScrollFactor(0).setDepth(this.depth + 2 + i)
    );

    this.basePositions = {
      title: { x: 0, y: 0 },
      speedVal: { x: 0, y: 0 },
      speedUnit: { x: 0, y: 0 },
      rpmLabel: { x: 0, y: 0 },
      rpmVal: { x: 0, y: 0 },
      health: { x: 0, y: 0 },
      repair: { x: 0, y: 0 },
    };

    this.displayRpm = 1000;
    this.lastSpeed = 0;
  }

  resize(gameSize) {
    this.layout.width = Math.min(430, Math.max(320, gameSize.width * 0.33));
    this.layout.height = Math.min(410, Math.max(340, gameSize.height * 0.5));
    this.layout.x = gameSize.width - this.layout.width - this.margin;
    this.layout.y = gameSize.height - this.layout.height - this.margin;

    this.layout.centerX = this.layout.x + this.layout.width * 0.5;
    this.layout.centerY = this.layout.y + this.layout.height * 0.42;
    this.layout.radius = Math.min(124, this.layout.width * 0.36);

    const uiScale = Math.min(1.22, Math.max(0.9, this.layout.width / 360));
    this.motoTitle.setFontSize(Math.round(24 * uiScale));
    this.speedValueText.setFontSize(Math.round(84 * uiScale));
    this.speedUnitText.setFontSize(Math.round(24 * uiScale));
    this.rpmLabelText.setFontSize(Math.round(20 * uiScale));
    this.rpmValueText.setFontSize(Math.round(40 * uiScale));
    this.motoHealthText.setFontSize(Math.round(24 * uiScale));
    this.repairText.setFontSize(Math.round(20 * uiScale));

    this.basePositions = {
      title: {
        x: this.layout.centerX,
        y: this.layout.y + Math.round(22 * uiScale),
      },
      speedVal: {
        x: this.layout.centerX,
        y: this.layout.centerY + Math.round(6 * uiScale),
      },
      speedUnit: {
        x: this.layout.centerX,
        y: this.layout.centerY + Math.round(56 * uiScale),
      },
      rpmLabel: {
        x: this.layout.centerX - Math.round(18 * uiScale),
        y: this.layout.y + this.layout.height * 0.73,
      },
      rpmVal: {
        x: this.layout.centerX + Math.round(18 * uiScale),
        y: this.layout.y + this.layout.height * 0.73,
      },
      health: {
        x: this.layout.centerX,
        y: this.layout.y + this.layout.height * 0.86,
      },
      repair: {
        x: this.layout.centerX,
        y: this.layout.y + this.layout.height * 0.94,
      },
    };

    this.applyPositions(0, 0);
    this.drawStaticShell();
  }

  applyPositions(shakeX, shakeY) {
    this.motoTitle.setPosition(
      this.basePositions.title.x + shakeX,
      this.basePositions.title.y + shakeY
    );
    this.speedValueText.setPosition(
      this.basePositions.speedVal.x + shakeX,
      this.basePositions.speedVal.y + shakeY
    );
    this.speedUnitText.setPosition(
      this.basePositions.speedUnit.x + shakeX,
      this.basePositions.speedUnit.y + shakeY
    );

    this.rpmLabelText.setPosition(
      this.basePositions.rpmLabel.x + shakeX * 1.5,
      this.basePositions.rpmLabel.y + shakeY * 1.5
    );
    this.rpmValueText.setPosition(
      this.basePositions.rpmVal.x + shakeX * 1.5,
      this.basePositions.rpmVal.y + shakeY * 1.5
    );

    this.motoHealthText.setPosition(
      this.basePositions.health.x,
      this.basePositions.health.y
    );
    this.repairText.setPosition(
      this.basePositions.repair.x,
      this.basePositions.repair.y
    );
  }

  drawStaticShell() {
    this.staticGraphics.clear();
    this.staticGraphics.fillStyle(0x0c1622, 0.94);
    this.staticGraphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 34, tr: 0, bl: 0, br: 0 }
    );
    this.staticGraphics.lineStyle(3, 0x3a6a8f, 1);
    this.staticGraphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 34, tr: 0, bl: 0, br: 0 }
    );

    const cx = this.layout.centerX;
    const cy = this.layout.centerY;
    const r = this.layout.radius;
    const start = Phaser.Math.DegToRad(140);
    const end = Phaser.Math.DegToRad(400);

    this.staticGraphics.lineStyle(22, 0x1e2d3d, 1);
    this.staticGraphics.beginPath();
    this.staticGraphics.arc(cx, cy, r, start, end);
    this.staticGraphics.strokePath();

    const zones = [
      { t: 0.6, color: 0x64d97a },
      { t: 0.85, color: 0xffb347 },
      { t: 1, color: 0xff4b4b },
    ];

    let last = 0;
    zones.forEach((zone) => {
      this.staticGraphics.lineStyle(16, zone.color, 0.95);
      this.staticGraphics.beginPath();
      this.staticGraphics.arc(
        cx,
        cy,
        r,
        Phaser.Math.Linear(start, end, last),
        Phaser.Math.Linear(start, end, zone.t)
      );
      this.staticGraphics.strokePath();
      last = zone.t;
    });
  }

  update(moto, motoInfo = {}, deltaMs = 16.67) {
    if (!moto) return;

    const currentSpeed = moto.speedPxPerSec || 0;
    const speedRatio = speedPxPerSecToHudRatio(currentSpeed);
    const speedKmh = Math.round(
      Phaser.Math.Clamp(speedPxPerSecToKmh(currentSpeed), 0, HUD_MAX_SPEED_KMH)
    );

    const idleRpm = 1000;
    const rpmTarget = Phaser.Math.Clamp(1080 + speedRatio * 11000, idleRpm, 12000);
    const isDecelerating = currentSpeed < this.lastSpeed - 5;
    const safeDelta = Phaser.Math.Clamp(Number(deltaMs) || 16.67, 4, 50);
    const accelLerp = 1 - Math.exp((-RPM_ACCEL_RESPONSE * safeDelta) / 1000);
    const brakeLerp = 1 - Math.exp((-RPM_BRAKE_RESPONSE * safeDelta) / 1000);

    if (isDecelerating || currentSpeed <= 5) {
      this.displayRpm = Phaser.Math.Linear(this.displayRpm, idleRpm, brakeLerp);
    } else {
      this.displayRpm = Phaser.Math.Linear(this.displayRpm, rpmTarget, accelLerp);
    }

    this.lastSpeed = currentSpeed;
    const rpm = Math.round(this.displayRpm);

    let shakeX = 0;
    let shakeY = 0;
    if (rpm > 9500) {
      shakeX = Phaser.Math.Between(-5, 5);
      shakeY = Phaser.Math.Between(-5, 5);
      this.rpmValueText.setColor("#ff0000");
      this.rpmValueText.setScale(1.1);
    } else {
      this.rpmValueText.setColor("#ffd7a2");
      this.rpmValueText.setScale(1);
    }

    this.applyPositions(shakeX, shakeY);

    this.speedValueText.setText(String(speedKmh).padStart(3, "0"));
    this.rpmValueText.setText(String(rpm));

    const health = Math.max(0, Math.round(motoInfo.healthPercent ?? 100));
    this.motoHealthText.setText(`Salud: ${health}%`);
    if (health < 30) this.motoHealthText.setColor("#ff4b4b");
    else if (health < 60) this.motoHealthText.setColor("#ffb347");
    else this.motoHealthText.setColor("#52d273");

    if (motoInfo.repairing) {
      const percent = Math.round(
        (1 - (motoInfo.repairRemainingMs || 0) / (motoInfo.repairDurationMs || 1800)) *
          100
      );
      this.repairText.setText(`Reparando... ${percent}%`);
    } else {
      this.repairText.setText("");
    }

    this.drawDynamicNeedle(speedRatio, shakeX, shakeY, rpm);
  }

  drawDynamicNeedle(ratio, shakeX, shakeY, rpm) {
    this.needleGraphics.clear();

    const cx = this.layout.centerX + shakeX;
    const cy = this.layout.centerY + shakeY;
    const r = this.layout.radius;
    const start = Phaser.Math.DegToRad(140);
    const end = Phaser.Math.DegToRad(400);

    const angle = Phaser.Math.Linear(start, end, ratio);
    const len = r - 12;
    const tipX = cx + Math.cos(angle) * len;
    const tipY = cy + Math.sin(angle) * len;

    if (rpm > 9500) {
      for (let i = 0; i < 8; i += 1) {
        const fireX = tipX + Phaser.Math.Between(-15, 15);
        const fireY = tipY + Phaser.Math.Between(-15, 15);
        const colors = [0xff0000, 0xff6600, 0xffff00];
        this.needleGraphics.fillStyle(
          Phaser.Utils.Array.GetRandom(colors),
          Math.random()
        );
        this.needleGraphics.fillCircle(fireX, fireY, Phaser.Math.Between(2, 6));
      }
    }

    this.needleGraphics.lineStyle(6, 0x000000, 0.4);
    this.needleGraphics.beginPath();
    this.needleGraphics.moveTo(cx + 4, cy + 4);
    this.needleGraphics.lineTo(tipX + 4, tipY + 4);
    this.needleGraphics.strokePath();

    this.needleGraphics.lineStyle(5, 0xffffff, 1);
    this.needleGraphics.beginPath();
    this.needleGraphics.moveTo(cx, cy);
    this.needleGraphics.lineTo(tipX, tipY);
    this.needleGraphics.strokePath();

    this.needleGraphics.fillStyle(0x0c1622, 1);
    this.needleGraphics.fillCircle(cx, cy, 14);
    this.needleGraphics.fillStyle(rpm > 9500 ? 0xff0000 : 0xffffff, 1);
    this.needleGraphics.fillCircle(cx, cy, 6);
  }

  destroy() {
    this.staticGraphics.destroy();
    this.needleGraphics.destroy();
    this.textNodes.forEach((textNode) => textNode.destroy());
  }
}
