import { formatRaceTime, formatShortSeconds } from "./formatters.js";

export default class DeliveryPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;
    this.layout = { x: 16, y: 16, width: 420, height: 248 };

    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(this.depth);

    const panelTitleStyle = {
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

    this.deliveryTitle = scene.add.text(0, 0, "PEDIDOS", panelTitleStyle);
    this.orderText = scene.add.text(0, 0, "Pedido: 0/0", bodyStyle);
    this.destinationText = scene.add.text(0, 0, "Destino: N/A", {
      ...bodyStyle,
      fontSize: "18px",
      wordWrap: { width: this.layout.width - 34, useAdvancedWrap: true },
    });
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
    this.timerText = scene.add.text(0, 0, "Tiempo: 00:00.00", {
      ...bodyStyle,
      fontSize: "22px",
      fontStyle: "bold",
      color: "#a7d9ff",
    });
    this.resultText = scene.add.text(0, 0, "", {
      ...bodyStyle,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffe08a",
      wordWrap: { width: this.layout.width - 34, useAdvancedWrap: true },
    });

    this.textNodes = [
      this.deliveryTitle,
      this.orderText,
      this.destinationText,
      this.packageLifeText,
      this.qualityText,
      this.timerText,
      this.resultText,
    ];
    this.textNodes.forEach((node, index) => {
      node.setScrollFactor(0);
      node.setDepth(this.depth + 1 + index);
    });
  }

  resize(gameSize) {
    const width = gameSize.width;
    this.layout.x = 16;
    this.layout.y = 16;
    this.layout.width = Math.min(420, Math.max(300, width * 0.33));
    this.layout.height = 248;

    this.destinationText.setWordWrapWidth(this.layout.width - 34, true);
    this.resultText.setWordWrapWidth(this.layout.width - 34, true);

    this.deliveryTitle.setPosition(this.layout.x + 18, this.layout.y + 10);
    this.orderText.setPosition(this.layout.x + 18, this.layout.y + 48);
    this.destinationText.setPosition(this.layout.x + 18, this.layout.y + 78);
    this.packageLifeText.setPosition(this.layout.x + 18, this.layout.y + 132);
    this.qualityText.setPosition(this.layout.x + 18, this.layout.y + 178);
    this.timerText.setPosition(this.layout.x + this.layout.width * 0.5, this.layout.y + 178);
    this.resultText.setPosition(this.layout.x + 18, this.layout.y + 210);

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

  update(delivery = {}, timing = {}, resultText = "") {
    const currentOrder = Number(delivery.currentOrder || 0);
    const totalOrders = Number(delivery.totalOrders || 0);
    const destination = delivery.destination || "N/A";
    const qualityPercent = Math.max(0, Math.round(delivery.qualityPercent || 0));

    this.orderText.setText(`Pedido: ${currentOrder}/${totalOrders}`);
    this.destinationText.setText(`Destino: ${destination}`);

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

    const countdownLabel = timing.countdownLabel || "";
    const finishWindowRemainingMs = Number(timing.finishWindowRemainingMs || 0);
    if (countdownLabel) {
      this.timerText.setText(`Inicio: ${countdownLabel}`);
    } else if (finishWindowRemainingMs > 0) {
      this.timerText.setText(`Cierre: ${formatShortSeconds(finishWindowRemainingMs)}`);
    } else {
      this.timerText.setText(`Tiempo: ${formatRaceTime(timing.elapsedMs || 0)}`);
    }

    this.resultText.setText(resultText || "");
  }

  destroy() {
    this.graphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
