import { ITEM_TYPES } from "./catalog.js";

export const STOCK_ITEM_TYPES = Object.freeze({
  TURBO: "turbo",
});

export const NEGATIVE_ITEM_TYPES = Object.freeze([
  ITEM_TYPES.OIL,
  ITEM_TYPES.WALL,
  ITEM_TYPES.EMP,
]);

export const POSITIVE_INVENTORY_ITEM_TYPES = Object.freeze([
  ITEM_TYPES.SHIELD,
  ITEM_TYPES.GHOST,
]);

// Nitro/Turbo es positivo, pero vive en stock (cargas), no en inventario normal.
export const POSITIVE_SPECIAL_STOCK_ITEM_TYPES = Object.freeze([
  STOCK_ITEM_TYPES.TURBO,
]);

export const POSITIVE_ITEM_TYPES = Object.freeze([
  ...POSITIVE_INVENTORY_ITEM_TYPES,
  ...POSITIVE_SPECIAL_STOCK_ITEM_TYPES,
]);

export const POSITIVE_STOCK_TYPES = Object.freeze([
  ...POSITIVE_SPECIAL_STOCK_ITEM_TYPES,
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

export function isPositiveSpecialStockItemType(type) {
  return POSITIVE_SPECIAL_STOCK_ITEM_TYPES.includes(type);
}
