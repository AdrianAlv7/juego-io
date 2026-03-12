import CargoPanel from "./hud/CargoPanel.js";
import HeatPanel from "./hud/HeatPanel.js";
import RaceStatusPanel from "./hud/RaceStatusPanel.js";
import ResultsPanel from "./hud/ResultsPanel.js";
import TachometerPanel from "./hud/TachometerPanel.js";

const HUD_MARGIN = 0;

export default class DebugHUD {
  constructor(scene) {
    this.scene = scene;
    this.accumulator = 0;
    this.visible = true;

    // Variables de estado para detectar eventos
    this.lastOrderCount = 0;
    this.lastPackageHealth = 100;

    this.raceStatusPanel = new RaceStatusPanel(scene, {
      depth: 1300,
      margin: HUD_MARGIN,
    });
    this.cargoPanel = new CargoPanel(scene, {
      depth: 1290,
      margin: HUD_MARGIN,
    });
    this.tachometerPanel = new TachometerPanel(scene, {
      depth: 1300,
      margin: HUD_MARGIN,
    });
    this.heatPanel = new HeatPanel(scene, {
      depth: 1300,
      margin: Math.max(16, HUD_MARGIN + 18),
    });
    this.resultsPanel = new ResultsPanel(scene, { depth: 1360 });
    this.hudObjects = this.collectHudObjects();
    this.hudObjects.forEach((gameObject) => {
      gameObject.__isHudObject = true;
    });

    this.handleResize = this.handleResize.bind(this);
    scene.scale.on("resize", this.handleResize, this);
    this.handleResize(scene.scale.gameSize);
  }

  handleResize(gameSize) {
    this.raceStatusPanel.resize(gameSize);
    this.cargoPanel.resize(gameSize);
    this.tachometerPanel.resize(gameSize);
    this.heatPanel.resize(gameSize);
    this.resultsPanel.resize(gameSize);
  }

  update(moto, delta, info = {}) {
    this.tachometerPanel.update(moto, info.moto || {}, delta);
    this.heatPanel.update(info.moto?.heat || {});

    this.accumulator += delta;
    if (this.accumulator < 50) return;
    this.accumulator = 0;

    const deliveryData = info.delivery || {};
    
    // --- LÓGICA DE DETECCIÓN DE EVENTOS ---
    const currentOrderCount = Number(deliveryData.currentOrder || 0);
    const currentPackageHealth = Number(deliveryData.packageHealthPercent || 100);

    // ¿Entregó o agarró un pedido nuevo?
    if (currentOrderCount > this.lastOrderCount) {
      this.raceStatusPanel.triggerSuccessFlash();
    }
    
    // ¿Recibió daño severo? (Perdió más de 5% de vida de golpe)
    if (currentPackageHealth < this.lastPackageHealth - 5) {
      this.cargoPanel.triggerDamageEffect();
    }

    this.lastOrderCount = currentOrderCount;
    this.lastPackageHealth = currentPackageHealth;
    // --------------------------------------

    this.raceStatusPanel.update(deliveryData, info.timing || {});
    this.cargoPanel.update(deliveryData);

    if (!this.visible) {
      this.hudObjects.forEach((gameObject) => {
        gameObject.setVisible?.(false);
      });
    }
  }

  showResults(results = [], winnerId = null, selfId = null) {
    this.resultsPanel.show(results, winnerId, selfId);
  }

  hideResults() {
    this.resultsPanel.hide();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.hudObjects.forEach((gameObject) => {
      gameObject.setVisible?.(this.visible);
    });
  }

  collectHudObjects() {
    return [
      this.raceStatusPanel.graphics,
      this.raceStatusPanel.flashGraphics,
      ...this.raceStatusPanel.textNodes,
      this.cargoPanel.graphics,
      this.cargoPanel.flashGraphics,
      ...this.cargoPanel.textNodes,
      this.tachometerPanel.staticGraphics,
      this.tachometerPanel.flashGraphics,
      this.tachometerPanel.needleGraphics,
      this.tachometerPanel.heatBarGraphics,
      ...this.tachometerPanel.textNodes,
      this.heatPanel.graphics,
      this.heatPanel.barGraphics,
      ...this.heatPanel.textNodes,
      this.resultsPanel.graphics,
      this.resultsPanel.titleText,
      this.resultsPanel.tableText,
    ].filter(Boolean);
  }

  getHudObjects() {
    return this.hudObjects;
  }

  destroy() {
    this.scene.scale.off("resize", this.handleResize, this);
    this.hudObjects.forEach((gameObject) => {
      gameObject.__isHudObject = false;
    });
    this.hudObjects = [];
    this.raceStatusPanel.destroy();
    this.cargoPanel.destroy();
    this.tachometerPanel.destroy();
    this.heatPanel.destroy();
    this.resultsPanel.destroy();
  }
}
