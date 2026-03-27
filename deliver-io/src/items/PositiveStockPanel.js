export default class PositiveStockPanel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = Number(options.depth || 2140);
    this.margin = Number(options.margin || 18);
    this.onGrantTurbo = options.onGrantTurbo || null;
    this.visible = false;
    this.hostControlsVisible = false;
    this.lastState = {};

    this.layout = {
      x: this.margin,
      y: this.margin,
      width: 320,
      height: 102,
      buttonWidth: 108,
      buttonHeight: 34,
    };

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(this.depth);
    this.titleText = this.createText("", "21px", "#f4fbff", "bold");
    this.turboText = this.createText("", "18px", "#ffd27d");
    this.hintText = this.createText("", "15px", "#d7e3f4");
    this.grantButtonLabel = this.createText("+ Turbo", "16px", "#ffffff", "bold");
    this.textNodes = [
      this.titleText,
      this.turboText,
      this.hintText,
      this.grantButtonLabel,
    ];

    this.grantButton = scene.add
      .rectangle(0, 0, this.layout.buttonWidth, this.layout.buttonHeight, 0x215f48, 0.96)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 1)
      .setStrokeStyle(2, 0x9fffd6, 0.28)
      .setVisible(false);

    if (this.onGrantTurbo) {
      this.grantButton.on("pointerover", () => {
        if (!this.hostControlsVisible || !this.visible) return;
        this.grantButton.setFillStyle(0x2a7b5d, 0.98);
      });
      this.grantButton.on("pointerout", () => {
        this.grantButton.setFillStyle(0x215f48, 0.96);
      });
      this.grantButton.on("pointerdown", () => {
        if (!this.hostControlsVisible || !this.visible) return;
        this.onGrantTurbo?.();
      });
    }

    this.textNodes.forEach((node) => {
      node.setScrollFactor(0).setDepth(this.depth + 2);
      node.__isHudObject = true;
    });
    this.graphics.__isHudObject = true;
    this.grantButton.__isHudObject = true;

    this.handleResize = this.handleResize.bind(this);
    scene.scale.on("resize", this.handleResize, this);
    this.handleResize(scene.scale.gameSize);
    this.update();
    this.setVisible(false);
    this.setHostControlsVisible(false);
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
    this.layout.width = Math.min(380, Math.max(320, gameSize.width * 0.24));
    this.layout.height = 102;
    this.layout.x = gameSize.width / 2 - this.layout.width / 2;
    this.layout.y = gameSize.height - this.layout.height - this.margin;

    this.titleText.setPosition(this.layout.x + 18, this.layout.y + 14);
    this.turboText.setPosition(this.layout.x + 18, this.layout.y + 44);
    this.hintText.setPosition(this.layout.x + 18, this.layout.y + 68);

    const buttonX = this.layout.x + this.layout.width - this.layout.buttonWidth - 16;
    const buttonY = this.layout.y + 34;
    this.grantButton.setPosition(buttonX, buttonY);
    this.grantButtonLabel.setPosition(
      buttonX + this.layout.buttonWidth / 2,
      buttonY + this.layout.buttonHeight / 2
    );
    this.grantButtonLabel.setOrigin(0.5);
    this.draw();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.graphics.setVisible(this.visible);
    this.titleText.setVisible(this.visible);
    this.turboText.setVisible(this.visible);
    this.hintText.setVisible(this.visible);
    this.applyHostControlsVisibility();
    this.draw();
  }

  setHostControlsVisible(visible) {
    this.hostControlsVisible = Boolean(visible && this.onGrantTurbo);
    this.applyHostControlsVisibility();
    this.update(this.lastState);
  }

  applyHostControlsVisibility() {
    const showHostButton = this.visible && this.hostControlsVisible;
    this.grantButton.setVisible(showHostButton);
    this.grantButtonLabel.setVisible(showHostButton);

    if (showHostButton) {
      this.grantButton.setInteractive({ useHandCursor: true });
    } else {
      this.grantButton.disableInteractive();
      this.grantButton.setFillStyle(0x215f48, 0.96);
    }
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
    this.lastState = state;
    const turboCharges = Math.max(0, Number(state.turboCharges || 0));
    const debugMaxCharges = Math.max(
      0,
      Number(state.turboDebugMaxCharges || state.turboMaxCharges || 0)
    );

    this.titleText.setText("Stock Fijo");
    this.turboText.setText(`Turbo [X]: ${turboCharges}`);
    this.hintText.setText(
      this.hostControlsVisible
        ? `2 iniciales | Host test hasta ${debugMaxCharges}`
        : "2 iniciales | tercero en R2"
    );
  }

  getObjects() {
    return [this.graphics, this.grantButton, ...this.textNodes];
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    this.grantButton.disableInteractive();
    this.graphics.destroy();
    this.grantButton.destroy();
    this.textNodes.forEach((node) => node.destroy());
  }
}
