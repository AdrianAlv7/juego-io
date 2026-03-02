import { formatRaceTime, formatShortSeconds } from "./formatters.js";

function truncateSingleLine(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 3))}...`;
}

export default class RaceStatusPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1300;
    this.margin = options.margin ?? 16;

    this.layout = {
      x: this.margin,
      y: this.margin,
      width: 520,
      height: 168,
    };
    this.destinationMaxChars = 34;

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.flashGraphics = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    const bodyStyle = {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "26px",
      color: "#d7e1ef",
      fontStyle: "bold",
    };

    this.orderText = scene.add.text(0, 0, "Pedido 0/0", bodyStyle);
    this.destinationText = scene.add.text(0, 0, "Destino: N/A", {
      ...bodyStyle,
      fontSize: "22px",
      color: "#a7d9ff",
    });
    this.timerText = scene.add.text(0, 0, "00:00.00", {
      ...bodyStyle,
      fontSize: "38px",
      color: "#ffffff",
    });
    this.timerText.setOrigin(1, 0);

    this.textNodes = [this.orderText, this.destinationText, this.timerText];
    this.textNodes.forEach((node, i) => {
      node.setScrollFactor(0).setDepth(this.depth + 2 + i);
    });
  }

  resize(gameSize) {
    this.layout.x = this.margin;
    this.layout.y = this.margin;
    this.layout.width = Math.min(560, Math.max(420, gameSize.width * 0.38));
    this.layout.height = Math.min(188, Math.max(156, gameSize.height * 0.2));

    const uiScale = Math.min(1.15, Math.max(0.85, this.layout.width / 520));
    this.orderText.setFontSize(Math.round(34 * uiScale));
    this.destinationText.setFontSize(Math.round(23 * uiScale));
    this.timerText.setFontSize(Math.round(38 * uiScale));
    this.destinationMaxChars = Math.max(
      22,
      Math.floor((this.layout.width - 60) / 11)
    );

    this.orderText.setPosition(this.layout.x + 22, this.layout.y + 16);
    this.timerText.setPosition(
      this.layout.x + this.layout.width - 22,
      this.layout.y + 12
    );
    this.destinationText.setPosition(
      this.layout.x + 22,
      this.layout.y + this.layout.height - Math.round(44 * uiScale)
    );

    this.drawShell();
  }

  drawShell() {
    this.graphics.clear();
    this.graphics.fillStyle(0x08131f, 0.9);
    this.graphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 0, tr: 0, bl: 0, br: 30 }
    );

    this.graphics.lineStyle(2, 0x3a6a8f, 1);
    this.graphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 0, tr: 0, bl: 0, br: 30 }
    );
  }

  triggerSuccessFlash() {
    this.flashGraphics.clear();
    this.flashGraphics.fillStyle(0x52d273, 0.6);
    this.flashGraphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      { tl: 0, tr: 0, bl: 0, br: 30 }
    );
    this.flashGraphics.setAlpha(1);

    this.scene.tweens.add({
      targets: this.flashGraphics,
      alpha: 0,
      duration: 500,
      ease: "Power2",
    });
  }

  update(delivery = {}, timing = {}) {
    const currentOrder = Number(delivery.currentOrder || 0);
    const totalOrders = Number(delivery.totalOrders || 0);
    const destination = delivery.destination || "Buscando...";
    const compactDest = truncateSingleLine(destination, this.destinationMaxChars);

    this.orderText.setText(`Pedido ${currentOrder}/${totalOrders}`);
    this.destinationText.setText(`Destino: ${compactDest}`);

    const finishWindow = Number(timing.finishWindowRemainingMs || 0);
    if (timing.countdownLabel) {
      this.timerText.setText(`Inicio ${timing.countdownLabel}`);
      this.timerText.setColor("#ffffff");
    } else if (finishWindow > 0) {
      this.timerText.setText(`Cierre ${formatShortSeconds(finishWindow)}`);
      this.timerText.setColor("#ff4b4b");
    } else {
      this.timerText.setText(formatRaceTime(timing.elapsedMs || 0));
      this.timerText.setColor("#ffffff");
    }
  }

  destroy() {
    this.graphics.destroy();
    this.flashGraphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
