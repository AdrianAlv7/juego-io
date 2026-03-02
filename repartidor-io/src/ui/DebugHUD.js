import CargoPanel from "./hud/CargoPanel.js";
import RaceStatusPanel from "./hud/RaceStatusPanel.js";
import ResultsPanel from "./hud/ResultsPanel.js";
import TachometerPanel from "./hud/TachometerPanel.js";

const HUD_LAYOUT = {
  raceStatus: { x: 16, y: 16 },
  cargo: { x: 16, y: 172 },
};

export default class DebugHUD {
  constructor(scene) {
    this.scene = scene;
    this.accumulator = 0;

    this.raceStatusPanel = new RaceStatusPanel(scene, {
      depth: 1300,
      ...HUD_LAYOUT.raceStatus,
    });
    this.cargoPanel = new CargoPanel(scene, {
      depth: 1300,
      ...HUD_LAYOUT.cargo,
    });
    this.tachometerPanel = new TachometerPanel(scene, { depth: 1300 });
    this.resultsPanel = new ResultsPanel(scene, { depth: 1360 });

    this.handleResize = this.handleResize.bind(this);
    scene.scale.on("resize", this.handleResize, this);
    this.handleResize(scene.scale.gameSize);
  }

  handleResize(gameSize) {
    this.raceStatusPanel.resize(gameSize);
    this.cargoPanel.resize(gameSize);
    this.tachometerPanel.resize(gameSize);
    this.resultsPanel.resize(gameSize);
  }

  update(moto, delta, info = {}) {
    this.accumulator += delta;
    if (this.accumulator < 50) return;
    this.accumulator = 0;

    const deliveryData = info.delivery || {};
    this.raceStatusPanel.update(deliveryData, info.timing || {});
    this.cargoPanel.update(deliveryData, info.resultText || "");
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
    this.raceStatusPanel.destroy();
    this.cargoPanel.destroy();
    this.tachometerPanel.destroy();
    this.resultsPanel.destroy();
  }
}
