import { ITEM_TYPES } from "./catalog.js";

export const STOCK_ITEM_TYPES = Object.freeze({
  TURBO: "turbo",
});

export const NEGATIVE_ITEM_TYPES = Object.freeze([
  ITEM_TYPES.OIL,
  ITEM_TYPES.WALL,
  ITEM_TYPES.EMP,
]);

export const POSITIVE_ITEM_TYPES = Object.freeze([
  ITEM_TYPES.SHIELD,
  STOCK_ITEM_TYPES.TURBO,
]);

export const POSITIVE_INVENTORY_ITEM_TYPES = Object.freeze([
  ITEM_TYPES.SHIELD,
]);

export const POSITIVE_STOCK_TYPES = Object.freeze([
  STOCK_ITEM_TYPES.TURBO,
]);

export const ROUTE_REWARD_ITEM_POOL = Object.freeze([
  ...NEGATIVE_ITEM_TYPES,
  ...POSITIVE_INVENTORY_ITEM_TYPES,
]);

export function isNegativeItemType(type) {
  return NEGATIVE_ITEM_TYPES.includes(type);
}

export function isPositiveItemType(type) {
  return POSITIVE_ITEM_TYPES.includes(type);
}

export function isPositiveInventoryItemType(type) {
  return POSITIVE_INVENTORY_ITEM_TYPES.includes(type);
}

export function isPositiveStockType(type) {
  return POSITIVE_STOCK_TYPES.includes(type);
}
