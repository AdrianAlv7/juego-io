export default class PositiveStockPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = Number(options.depth || 2140);
    this.margin = Number(options.margin || 18);
    this.visible = false;

    this.layout = {
      x: this.margin,
      y: this.margin,
      width: 320,
      height: 118,
    };

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.titleText = this.createText("", "21px", "#f4fbff", "bold");
    this.turboText = this.createText("", "18px", "#ffd27d");
    this.hintText = this.createText("", "16px", "#d7e3f4");
    this.textNodes = [
      this.titleText,
      this.turboText,
      this.hintText,
    ];

    this.textNodes.forEach((node) => {
      node.setScrollFactor(0).setDepth(this.depth + 1);
      node.__isHudObject = true;
    });
    this.graphics.__isHudObject = true;

    this.handleResize = this.handleResize.bind(this);
    scene.scale.on("resize", this.handleResize, this);
    this.handleResize(scene.scale.gameSize);
    this.update();
    this.setVisible(false);
  }

  createText(text, fontSize, color, fontStyle = "normal") {
    return this.scene.add.text(0, 0, text, {
      fontFamily: "Consolas, monospace",
      fontSize,
      fontStyle,
      color,
    });
  }

  handleResize(gameSize) {
    this.layout.width = Math.min(340, Math.max(300, gameSize.width * 0.22));
    this.layout.height = 92;
    this.layout.x = gameSize.width / 2 - this.layout.width / 2;
    this.layout.y = gameSize.height - this.layout.height - this.margin;

    this.titleText.setPosition(this.layout.x + 18, this.layout.y + 14);
    this.turboText.setPosition(this.layout.x + 18, this.layout.y + 46);
    this.hintText.setPosition(this.layout.x + 18, this.layout.y + 68);
    this.draw();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.graphics.setVisible(this.visible);
    this.textNodes.forEach((node) => node.setVisible(this.visible));
    this.draw();
  }

  draw() {
    this.graphics.clear();
    if (!this.visible) return;

    this.graphics.fillStyle(0x09111a, 0.92);
    this.graphics.fillRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      18
    );
    this.graphics.lineStyle(2, 0xffffff, 0.14);
    this.graphics.strokeRoundedRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      18
    );
  }

  update(state = {}) {
    const turboCharges = Math.max(0, Number(state.turboCharges || 0));

    this.titleText.setText("Stock Fijo");
    this.turboText.setText(`Turbo [X]: ${turboCharges}`);
    this.hintText.setText("2 iniciales | tercero en R2");
  }

  getObjects() {
    return [this.graphics, ...this.textNodes];
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    this.graphics.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
