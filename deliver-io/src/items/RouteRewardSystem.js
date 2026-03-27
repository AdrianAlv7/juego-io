export const ROUTE_REWARD_KEYS = Object.freeze({
  R1_ITEM: "R1_ITEM",
  R2_TURBO: "R2_TURBO",
  E2_ITEM: "E2_ITEM",
  R3_ITEM: "R3_ITEM",
});

export default class RouteRewardSystem {
  constructor(options = {}) {
    this.onGrantItem = options.onGrantItem || null;
    this.onGrantTurbo = options.onGrantTurbo || null;
    this.reset();
  }

  reset() {
    this.claimed = new Set();
  }

  handleCompletedObjective(completed = {}) {
    const kind = completed.kind;
    const orderNumber = Number(completed.orderNumber || 0);

    if (kind === "pickup" && orderNumber === 1) {
      this.claimItemReward(ROUTE_REWARD_KEYS.R1_ITEM);
      return;
    }

    if (kind === "pickup" && orderNumber === 2) {
      this.claimTurboReward(ROUTE_REWARD_KEYS.R2_TURBO);
      return;
    }

    if (kind === "dropoff" && orderNumber === 2) {
      this.claimItemReward(ROUTE_REWARD_KEYS.E2_ITEM);
      return;
    }

    if (kind === "pickup" && orderNumber === 3) {
      this.claimItemReward(ROUTE_REWARD_KEYS.R3_ITEM);
    }
  }

  claimItemReward(key) {
    if (!key || this.claimed.has(key)) return false;
    this.claimed.add(key);
    this.onGrantItem?.(key);
    return true;
  }

  claimTurboReward(key) {
    if (!key || this.claimed.has(key)) return false;
    this.claimed.add(key);
    this.onGrantTurbo?.(key);
    return true;
  }
}
