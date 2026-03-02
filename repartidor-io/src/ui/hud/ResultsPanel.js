export default class ResultsPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 1350;
    this.layout = { x: 0, y: 90, width: 620, height: 280 };

    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(this.depth);

    this.titleText = scene.add.text(0, 0, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "30px",
      color: "#e7f2ff",
      fontStyle: "bold",
      align: "center",
    });
    this.titleText.setOrigin(0.5, 0);
    this.titleText.setScrollFactor(0);
    this.titleText.setDepth(this.depth + 1);

    this.tableText = scene.add.text(0, 0, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "18px",
      color: "#dce8f5",
      align: "left",
      lineSpacing: 6,
      wordWrap: { width: 580, useAdvancedWrap: true },
    });
    this.tableText.setOrigin(0.5, 0);
    this.tableText.setScrollFactor(0);
    this.tableText.setDepth(this.depth + 1);

    this.hide();
  }

  resize(gameSize) {
    this.layout.width = Math.min(760, Math.max(360, gameSize.width * 0.58));
    this.layout.height = Math.min(420, Math.max(240, gameSize.height * 0.42));
    this.layout.x = (gameSize.width - this.layout.width) * 0.5;
    this.layout.y = Math.max(90, (gameSize.height - this.layout.height) * 0.24);

    this.titleText.setPosition(gameSize.width * 0.5, this.layout.y + 16);
    this.tableText.setPosition(gameSize.width * 0.5, this.layout.y + 64);
    this.tableText.setWordWrapWidth(this.layout.width - 28, true);

    this.drawShell();
  }

  drawShell() {
    this.graphics.clear();
    if (!this.visible) return;

    this.graphics.fillStyle(0x06111d, 0.86);
    this.graphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      18
    );
    this.graphics.lineStyle(2, 0x4b6f8c, 1);
    this.graphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      18
    );
  }

  buildRows(results = []) {
    const header = "Pos  Jugador      Pts   Tiempo    Calidad";
    const sep = "------------------------------------------";
    const rows = results.map((entry, index) => {
      const pos = String(index + 1).padStart(2, " ");
      const name = String(entry.name || "Jugador").slice(0, 11).padEnd(11, " ");
      const score = String(Number.isFinite(entry.score) ? entry.score : 0).padStart(3, " ");
      const time = entry.didFinish
        ? `${(entry.elapsedMs / 1000).toFixed(2)}s`.padStart(8, " ")
        : "   DNF  ";
      const quality = entry.didFinish
        ? `${entry.qualityPercent}%`.padStart(6, " ")
        : "   -  ";
      return `${pos}   ${name}   ${score}   ${time}   ${quality}`;
    });

    return [header, sep, ...rows].join("\n");
  }

  show(results = [], winnerId = null, selfId = null) {
    this.visible = true;
    const isWinner = winnerId && selfId && winnerId === selfId;
    this.titleText.setText(isWinner ? "GANASTE" : "RESULTADOS FINALES");
    this.titleText.setColor(isWinner ? "#9af5b2" : "#ffd1a0");
    this.tableText.setText(this.buildRows(results));

    this.titleText.setVisible(true);
    this.tableText.setVisible(true);
    this.drawShell();
  }

  hide() {
    this.visible = false;
    this.graphics.clear();
    this.titleText.setVisible(false);
    this.tableText.setVisible(false);
  }

  destroy() {
    this.graphics.destroy();
    this.titleText.destroy();
    this.tableText.destroy();
  }
}
