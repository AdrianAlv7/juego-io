import Phaser from "phaser";

export default class NightVisionOverlay {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 2120;
    this.blockedRatio = options.blockedRatio ?? 0.35;
    this.color = options.color ?? 0x000000;
    this.alpha = options.alpha ?? 1;
    this.active = false;
    this.size = {
      width: 0,
      height: 0,
    };
    this.focus = {
      x: 0,
      y: 0,
    };

    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(this.depth);
    this.graphics.setVisible(false);
  }

  resize(gameSize) {
    this.size.width = Math.max(0, Number(gameSize?.width) || 0);
    this.size.height = Math.max(0, Number(gameSize?.height) || 0);
    this.focus.x = this.size.width * 0.5;
    this.focus.y = this.size.height * 0.5;
    this.render();
  }

  setActive(active, options = {}) {
    this.active = Boolean(active);
    if (options.blockedRatio != null) {
      this.blockedRatio = Phaser.Math.Clamp(Number(options.blockedRatio) || 0, 0, 0.8);
    }
    if (options.color != null) {
      this.color = options.color;
    }
    if (options.alpha != null) {
      this.alpha = Phaser.Math.Clamp(Number(options.alpha) || 0, 0, 1);
    }
    this.render();
  }

  setFocus(x, y) {
    this.focus.x = Number.isFinite(x) ? x : this.size.width * 0.5;
    this.focus.y = Number.isFinite(y) ? y : this.size.height * 0.5;
    this.render();
  }

  render() {
    this.graphics.clear();

    if (!this.active || this.size.width <= 0 || this.size.height <= 0) {
      this.graphics.setVisible(false);
      return;
    }

    const horizontalMargin = Math.round(this.size.width * this.blockedRatio);
    const verticalMargin = Math.round(this.size.height * this.blockedRatio);
    const visibleWidth = Math.max(220, this.size.width - horizontalMargin * 2);
    const visibleHeight = Math.max(180, this.size.height - verticalMargin * 2);
    const holeLeft = Math.round(this.focus.x - visibleWidth * 0.5);
    const holeTop = Math.round(this.focus.y - visibleHeight * 0.5);
    const holeRight = holeLeft + visibleWidth;
    const holeBottom = holeTop + visibleHeight;
    const visibleTop = Phaser.Math.Clamp(holeTop, 0, this.size.height);
    const visibleBottom = Phaser.Math.Clamp(holeBottom, 0, this.size.height);
    const holeHeight = Math.max(0, visibleBottom - visibleTop);
    const leftWidth = Phaser.Math.Clamp(holeLeft, 0, this.size.width);
    const rightX = Phaser.Math.Clamp(holeRight, 0, this.size.width);

    this.graphics.fillStyle(this.color, this.alpha);
    this.graphics.fillRect(0, 0, this.size.width, visibleTop);
    this.graphics.fillRect(
      0,
      visibleBottom,
      this.size.width,
      this.size.height - visibleBottom
    );
    this.graphics.fillRect(0, visibleTop, leftWidth, holeHeight);
    this.graphics.fillRect(
      rightX,
      visibleTop,
      this.size.width - rightX,
      holeHeight
    );
    this.graphics.setVisible(true);
  }

  getObjects() {
    return [this.graphics];
  }

  destroy() {
    this.graphics.destroy();
  }
}
