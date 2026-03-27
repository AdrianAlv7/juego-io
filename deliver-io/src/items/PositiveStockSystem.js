import { STOCK_ITEM_CONFIG } from "./catalog.js";

export default class PositiveStockSystem {
  constructor(options = {}) {
    this.onStateChanged = options.onStateChanged || null;
    this.resetForMatch();
  }

  resetForMatch() {
    this.turboCharges = STOCK_ITEM_CONFIG.turbo.startingCharges;
    this.extraTurboGranted = false;
    this.emitStateChanged();
  }

  emitStateChanged() {
    this.onStateChanged?.(this.getHudState());
  }

  useTurbo(moto) {
    if (this.turboCharges <= 0) return false;
    if (!moto?.activateTurbo?.(STOCK_ITEM_CONFIG.turbo)) return false;
    this.turboCharges = Math.max(0, this.turboCharges - 1);
    this.emitStateChanged();
    return true;
  }

  grantExtraTurbo() {
    if (this.extraTurboGranted) return false;
    this.extraTurboGranted = true;
    this.turboCharges = Math.min(
      STOCK_ITEM_CONFIG.turbo.maxCharges,
      this.turboCharges + 1
    );
    this.emitStateChanged();
    return true;
  }

  grantDebugTurbo(amount = 1) {
    const nextAmount = Math.max(1, Number(amount || 1));
    const debugMaxCharges =
      STOCK_ITEM_CONFIG.turbo.debugMaxCharges ||
      STOCK_ITEM_CONFIG.turbo.maxCharges;
    const previousCharges = this.turboCharges;
    this.turboCharges = Math.min(debugMaxCharges, this.turboCharges + nextAmount);
    if (this.turboCharges === previousCharges) return false;
    this.emitStateChanged();
    return true;
  }

  getHudState() {
    return {
      turboCharges: this.turboCharges,
      turboMaxCharges: STOCK_ITEM_CONFIG.turbo.maxCharges,
      turboDebugMaxCharges:
        STOCK_ITEM_CONFIG.turbo.debugMaxCharges ||
        STOCK_ITEM_CONFIG.turbo.maxCharges,
      extraTurboGranted: this.extraTurboGranted,
    };
  }
}
