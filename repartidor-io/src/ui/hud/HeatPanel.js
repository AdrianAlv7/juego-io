import Phaser from "phaser";

export default class HeatPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;
    this.margin = options.margin ?? 16;

    this.layout = {
      x: 0,
      y: 0,
      width: 400,
      height: 170,
    };
    this.barLayout = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.barGraphics = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    const baseStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      color: "#f6f7fb",
      fontStyle: "bold",
    };

    this.titleText = scene.add.text(0, 0, "CALOR MOTOR", {
      ...baseStyle,
      fontSize: "24px",
      color: "#ffd58f",
    });
    this.valueText = scene.add.text(0, 0, "0%", {
      ...baseStyle,
      fontSize: "60px",
    });
    this.statusText = scene.add.text(0, 0, "", {
      ...baseStyle,
      fontSize: "24px",
    });
    this.hintText = scene.add.text(0, 0, "", {
      ...baseStyle,
      fontSize: "18px",
      fontStyle: "normal",
      color: "#d5dfef",
    });

    this.textNodes = [
      this.titleText,
      this.valueText,
      this.statusText,
      this.hintText,
    ];
    this.textNodes.forEach((node, index) =>
      node.setScrollFactor(0).setDepth(this.depth + 2 + index)
    );

    this.setVisible(false);
  }

  resize(gameSize) {
    this.layout.width = Math.min(460, Math.max(360, gameSize.width * 0.26));
    this.layout.height = Math.min(190, Math.max(156, gameSize.height * 0.18));
    this.layout.x = gameSize.width - this.layout.width - this.margin;
    this.layout.y = this.margin;

    const uiScale = Math.min(1.18, Math.max(0.92, this.layout.width / 400));
    this.titleText.setFontSize(Math.round(24 * uiScale));
    this.valueText.setFontSize(Math.round(60 * uiScale));
    this.statusText.setFontSize(Math.round(24 * uiScale));
    this.hintText.setFontSize(Math.round(18 * uiScale));

    this.titleText.setPosition(this.layout.x + 20, this.layout.y + 16);
    this.valueText.setPosition(this.layout.x + 20, this.layout.y + 50);
    this.statusText.setPosition(
      this.layout.x + this.layout.width - 20,
      this.layout.y + 60
    );
    this.statusText.setOrigin(1, 0);
    this.hintText.setPosition(
      this.layout.x + 20,
      this.layout.y + this.layout.height - Math.round(56 * uiScale)
    );
    this.hintText.setWordWrapWidth(this.layout.width - 40);

    this.barLayout = {
      x: this.layout.x + 20,
      y: this.layout.y + this.layout.height - Math.round(28 * uiScale),
      width: this.layout.width - 40,
      height: Math.max(18, Math.round(22 * uiScale)),
    };
  }

  setVisible(visible) {
    this.graphics.setVisible(visible);
    this.barGraphics.setVisible(visible);
    this.textNodes.forEach((node) => node.setVisible(visible));
  }

  drawShell(accentColor) {
    this.graphics.clear();
    this.graphics.fillStyle(0x160d08, 0.94);
    this.graphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      24
    );
    this.graphics.fillStyle(accentColor, 0.12);
    this.graphics.fillRoundedRect(
      this.layout.x + 4,
      this.layout.y + 4,
      this.layout.width - 8,
      this.layout.height - 8,
      20
    );
    this.graphics.lineStyle(3, accentColor, 0.9);
    this.graphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      24
    );
  }

  update(heatInfo = {}) {
    const visible = Boolean(heatInfo.active);
    this.setVisible(visible);
    this.barGraphics.clear();

    if (!visible) {
      this.graphics.clear();
      this.statusText.setText("");
      this.hintText.setText("");
      return;
    }

    const heatPercent = Phaser.Math.Clamp(Number(heatInfo.percent || 0), 0, 1);
    const accentColor = heatInfo.cooling
      ? 0x7ad7ff
      : heatPercent >= 0.82
        ? 0xff6e5f
        : heatPercent >= 0.55
          ? 0xffc75f
          : 0x6ce18d;

    this.drawShell(accentColor);

    this.titleText.setColor(heatInfo.cooling ? "#b8ecff" : "#ffd58f");
    this.valueText.setText(`${Math.round(heatPercent * 100)}%`);
    this.valueText.setColor(
      heatInfo.cooling
        ? "#b8ecff"
        : heatPercent >= 0.82
          ? "#ff8a7c"
          : "#ffffff"
    );

    const statusText = heatInfo.statusText || (heatPercent >= 0.55 ? "Caliente" : "Estable");
    this.statusText.setText(statusText);
    this.statusText.setColor(
      heatInfo.cooling
        ? "#7ad7ff"
        : heatInfo.statusText
          ? "#ff8f6d"
          : "#cfe2ff"
    );

    this.hintText.setText(
      heatInfo.cooling
        ? "Enfriando motor para recuperar empuje"
        : "Modula el gas para no quedarte varado"
    );

    this.barGraphics.fillStyle(0x1f2630, 0.96);
    this.barGraphics.fillRoundedRect(
      this.barLayout.x,
      this.barLayout.y,
      this.barLayout.width,
      this.barLayout.height,
      10
    );

    if (heatPercent > 0) {
      this.barGraphics.fillStyle(accentColor, 1);
      this.barGraphics.fillRoundedRect(
        this.barLayout.x,
        this.barLayout.y,
        this.barLayout.width * heatPercent,
        this.barLayout.height,
        10
      );
    }

    this.barGraphics.lineStyle(2, 0xffffff, 0.22);
    this.barGraphics.strokeRoundedRect(
      this.barLayout.x,
      this.barLayout.y,
      this.barLayout.width,
      this.barLayout.height,
      10
    );
  }

  destroy() {
    this.graphics.destroy();
    this.barGraphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
