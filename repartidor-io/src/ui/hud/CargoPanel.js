export default class CargoPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;
    this.layout = {
      x: options.x ?? 16,
      y: options.y ?? 172,
      width: 420,
      height: 126,
    };

    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(this.depth);

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

    this.titleText = scene.add.text(0, 0, "CARGA", titleStyle);
    this.packageLifeText = scene.add.text(0, 0, "Vida pedido: N/A", {
      ...bodyStyle,
      fontSize: "30px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    this.qualityText = scene.add.text(0, 0, "Calidad: 0%", {
      ...bodyStyle,
      fontSize: "22px",
      fontStyle: "bold",
    });
    this.resultText = scene.add.text(0, 0, "", {
      ...bodyStyle,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffe08a",
      wordWrap: { width: this.layout.width - 34, useAdvancedWrap: true },
    });
    this.resultText.setOrigin(0.5, 0);

    this.textNodes = [
      this.titleText,
      this.packageLifeText,
      this.qualityText,
      this.resultText,
    ];
    this.textNodes.forEach((node, index) => {
      node.setScrollFactor(0);
      node.setDepth(this.depth + 1 + index);
    });
  }

  resize(gameSize) {
    this.layout.width = Math.min(420, Math.max(300, gameSize.width * 0.33));
    this.layout.height = 126;

    this.resultText.setWordWrapWidth(this.layout.width - 34, true);

    this.titleText.setPosition(this.layout.x + 18, this.layout.y + 8);
    this.packageLifeText.setPosition(this.layout.x + 18, this.layout.y + 38);
    this.qualityText.setPosition(this.layout.x + 18, this.layout.y + 84);
    this.resultText.setPosition(this.layout.x + this.layout.width * 0.5, this.layout.y + 84);

    this.drawShell();
  }

  drawShell() {
    this.graphics.clear();
    this.graphics.fillStyle(0x08131f, 0.78);
    this.graphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      16
    );
    this.graphics.lineStyle(2, 0x2f5169, 1);
    this.graphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      16
    );
  }

  update(delivery = {}, resultText = "") {
    const qualityPercent = Math.max(0, Math.round(delivery.qualityPercent || 0));

    if (delivery.packageHealthPercent === null || delivery.packageHealthPercent === undefined) {
      this.packageLifeText.setText("Vida pedido: N/A");
      this.packageLifeText.setColor("#9ca4ad");
    } else {
      const packageHealthPercent = Math.max(0, Math.round(delivery.packageHealthPercent));
      this.packageLifeText.setText(`Vida pedido: ${packageHealthPercent}%`);
      this.packageLifeText.setColor(delivery.packageHealthColor || "#9ca4ad");
    }

    this.qualityText.setText(`Calidad: ${qualityPercent}%`);
    this.qualityText.setColor(delivery.qualityColor || "#d7e1ef");
    this.resultText.setText(resultText || "");
  }

  destroy() {
    this.graphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
