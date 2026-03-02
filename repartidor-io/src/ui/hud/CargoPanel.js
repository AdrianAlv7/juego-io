import Phaser from "phaser";

export default class CargoPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;
    this.margin = options.margin ?? 16;

    this.layout = {
      x: this.margin,
      y: 0,
      width: 500,
      height: 132,
    };
    this.shakeIntensity = 0;

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.flashGraphics = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    const bodyStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "24px",
      color: "#d7e1ef",
      fontStyle: "bold",
    };

    this.packageLifeText = scene.add.text(0, 0, "Integridad: N/A", {
      ...bodyStyle,
      fontSize: "32px",
    });
    this.qualityText = scene.add.text(0, 0, "Calidad: 0%", {
      ...bodyStyle,
      fontSize: "26px",
    });

    this.basePositions = {
      life: { x: 0, y: 0 },
      quality: { x: 0, y: 0 },
    };

    this.textNodes = [this.packageLifeText, this.qualityText];
    this.textNodes.forEach((node, i) =>
      node.setScrollFactor(0).setDepth(this.depth + 2 + i)
    );
  }

  resize(gameSize) {
    this.layout.width = Math.min(540, Math.max(400, gameSize.width * 0.4));
    this.layout.height = Math.min(152, Math.max(116, gameSize.height * 0.17));
    this.layout.x = this.margin;
    this.layout.y = gameSize.height - this.layout.height - this.margin;

    const uiScale = Math.min(1.18, Math.max(0.9, this.layout.width / 500));
    this.packageLifeText.setFontSize(Math.round(32 * uiScale));
    this.qualityText.setFontSize(Math.round(26 * uiScale));

    this.basePositions.life = {
      x: this.layout.x + 22,
      y: this.layout.y + Math.round(16 * uiScale),
    };
    this.basePositions.quality = {
      x: this.layout.x + 22,
      y: this.layout.y + this.layout.height - Math.round(44 * uiScale),
    };

    this.drawShell();
  }

  drawShell() {
    this.graphics.clear();
    this.graphics.fillStyle(0x06111d, 0.9);
    this.graphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 0, tr: 30, bl: 0, br: 0 }
    );
    this.graphics.lineStyle(2, 0x3a6a8f, 1);
    this.graphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 0, tr: 30, bl: 0, br: 0 }
    );
  }

  triggerDamageEffect() {
    this.shakeIntensity = 6;

    this.flashGraphics.clear();
    this.flashGraphics.fillStyle(0xff0000, 0.5);
    this.flashGraphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 0, tr: 30, bl: 0, br: 0 }
    );
    this.flashGraphics.setAlpha(1);

    this.scene.tweens.add({
      targets: this.flashGraphics,
      alpha: 0,
      duration: 400,
    });
    this.scene.tweens.add({
      targets: this,
      shakeIntensity: 0,
      duration: 500,
    });
  }

  update(delivery = {}) {
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0.5) {
      shakeX = Phaser.Math.Between(-this.shakeIntensity, this.shakeIntensity);
      shakeY = Phaser.Math.Between(-this.shakeIntensity, this.shakeIntensity);
    }

    this.packageLifeText.setPosition(
      this.basePositions.life.x + shakeX,
      this.basePositions.life.y + shakeY
    );
    this.qualityText.setPosition(
      this.basePositions.quality.x + shakeX,
      this.basePositions.quality.y + shakeY
    );

    const qualityPercent = Math.max(0, Math.round(delivery.qualityPercent || 0));
    this.qualityText.setText(`Calidad: ${qualityPercent}%`);
    this.qualityText.setColor(qualityPercent < 50 ? "#ffb347" : "#d7e1ef");

    if (delivery.packageHealthPercent == null) {
      this.packageLifeText.setText("Integridad: N/A");
      this.packageLifeText.setColor("#9ca4ad");
    } else {
      const hp = Math.max(0, Math.round(delivery.packageHealthPercent));
      this.packageLifeText.setText(`Integridad: ${hp}%`);
      this.packageLifeText.setColor(
        hp < 30 ? "#ff4b4b" : delivery.packageHealthColor || "#52d273"
      );
    }
  }

  destroy() {
    this.graphics.destroy();
    this.flashGraphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
