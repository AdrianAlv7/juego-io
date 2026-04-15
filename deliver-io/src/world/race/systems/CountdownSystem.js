import Phaser from "phaser";

export default class CountdownSystem {
  constructor(scene, options) {
    this.scene = scene;
    this.preStartMs = options.preStartMs;
    this.goVisibleMs = options.goVisibleMs;
    this.startMs = scene.time.now;
    this.currentLabel = "";
    this.suppressed = false;

    this.text = scene.add.text(scene.scale.width / 2, scene.scale.height * 0.2, "", {
      fontFamily: "Consolas",
      fontSize: "90px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 8,
      fontStyle: "bold",
    });
    this.text.setOrigin(0.5);
    this.text.setScrollFactor(0);
    this.text.setDepth(1100);
    this.text.setVisible(false);

    scene.scale.on("resize", this.handleResize, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off("resize", this.handleResize, this);
    });
  }

  handleResize(gameSize) {
    this.text.setPosition(gameSize.width / 2, gameSize.height * 0.2);
  }

  isLocked() {
    return this.scene.time.now - this.startMs < this.preStartMs;
  }

  getLabel() {
    return this.currentLabel;
  }

  setSuppressed(suppressed) {
    this.suppressed = Boolean(suppressed);
    if (this.suppressed) {
      this.text.setVisible(false);
    }
  }

  update() {
    if (this.suppressed) {
      this.text.setVisible(false);
      return;
    }

    const elapsed = this.scene.time.now - this.startMs;
    let nextLabel = "";

    if (elapsed < 1000) nextLabel = "3";
    else if (elapsed < 2000) nextLabel = "2";
    else if (elapsed < 3000) nextLabel = "1";
    else if (elapsed < this.preStartMs + this.goVisibleMs) nextLabel = "GO!";

    if (nextLabel === this.currentLabel) return;
    this.currentLabel = nextLabel;
    this.text.setText(nextLabel);
    this.text.setVisible(Boolean(nextLabel));
    this.text.setScale(nextLabel === "GO!" ? 1.12 : 1);
    this.text.setColor(nextLabel === "GO!" ? "#94f7a0" : "#ffffff");
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    this.text.destroy();
  }
}
