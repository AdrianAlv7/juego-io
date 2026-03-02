import DeliveryPanel from "./hud/DeliveryPanel.js";
import ResultsPanel from "./hud/ResultsPanel.js";
import TachometerPanel from "./hud/TachometerPanel.js";

export default class DebugHUD {
  constructor(scene) {
    this.scene = scene;
    this.accumulator = 0;

    this.deliveryPanel = new DeliveryPanel(scene, { depth: 1300 });
    this.tachometerPanel = new TachometerPanel(scene, { depth: 1300 });
    this.resultsPanel = new ResultsPanel(scene, { depth: 1360 });

    this.handleResize = this.handleResize.bind(this);
    scene.scale.on("resize", this.handleResize, this);
    this.handleResize(scene.scale.gameSize);
  }

  handleResize(gameSize) {
    this.deliveryPanel.resize(gameSize);
    this.tachometerPanel.resize(gameSize);
    this.resultsPanel.resize(gameSize);
  }

  update(moto, delta, info = {}) {
    this.accumulator += delta;
    if (this.accumulator < 50) return;
    this.accumulator = 0;

    this.deliveryPanel.update(info.delivery || {}, info.timing || {}, info.resultText || "");
    this.tachometerPanel.update(moto, info.moto || {});
  }

  showResults(results = [], winnerId = null, selfId = null) {
    this.resultsPanel.show(results, winnerId, selfId);
  }

  hideResults() {
    this.resultsPanel.hide();
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    this.deliveryPanel.destroy();
    this.tachometerPanel.destroy();
    this.resultsPanel.destroy();
  }
}
