import { formatRaceTime, formatShortSeconds } from "./formatters.js";

export default class RaceStatusPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;
    this.layout = {
      x: options.x ?? 16,
      y: options.y ?? 16,
      width: 420,
      height: 148,
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

    this.titleText = scene.add.text(0, 0, "PARTIDA", titleStyle);
    this.orderText = scene.add.text(0, 0, "Pedido: 0/0", bodyStyle);
    this.destinationText = scene.add.text(0, 0, "Destino: N/A", {
      ...bodyStyle,
      fontSize: "18px",
      wordWrap: { width: this.layout.width - 34, useAdvancedWrap: true },
    });
    this.timerText = scene.add.text(0, 0, "Tiempo: 00:00.00", {
      ...bodyStyle,
      fontSize: "22px",
      fontStyle: "bold",
      color: "#a7d9ff",
    });
    this.timerText.setOrigin(0.5, 0);

    this.textNodes = [
      this.titleText,
      this.orderText,
      this.destinationText,
      this.timerText,
    ];
    this.textNodes.forEach((node, index) => {
      node.setScrollFactor(0);
      node.setDepth(this.depth + 1 + index);
    });
  }

  resize(gameSize) {
    this.layout.width = Math.min(420, Math.max(300, gameSize.width * 0.33));
    this.layout.height = 148;

    this.destinationText.setWordWrapWidth(this.layout.width - 34, true);

    this.titleText.setPosition(this.layout.x + 18, this.layout.y + 10);
    this.orderText.setPosition(this.layout.x + 18, this.layout.y + 48);
    this.destinationText.setPosition(this.layout.x + 18, this.layout.y + 78);
    this.timerText.setPosition(
      this.layout.x + this.layout.width * 0.5,
      this.layout.y + 112
    );

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

  update(delivery = {}, timing = {}) {
    const currentOrder = Number(delivery.currentOrder || 0);
    const totalOrders = Number(delivery.totalOrders || 0);
    const destination = delivery.destination || "N/A";

    this.orderText.setText(`Pedido: ${currentOrder}/${totalOrders}`);
    this.destinationText.setText(`Destino: ${destination}`);

    const countdownLabel = timing.countdownLabel || "";
    const finishWindowRemainingMs = Number(timing.finishWindowRemainingMs || 0);
    if (countdownLabel) {
      this.timerText.setText(`Inicio: ${countdownLabel}`);
    } else if (finishWindowRemainingMs > 0) {
      this.timerText.setText(`Cierre: ${formatShortSeconds(finishWindowRemainingMs)}`);
    } else {
      this.timerText.setText(`Tiempo: ${formatRaceTime(timing.elapsedMs || 0)}`);
    }
  }

  destroy() {
    this.graphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
