import type { StockKind } from "../dto/inventory.dto";

/** Stock arithmetic — pure, no I/O. Quantities carry at most three decimals. */

const toMilli = (quantity: number): number => Math.round(quantity * 1000);

/** The signed change a movement makes to the quantity on hand. */
export function stockChange(kind: StockKind, quantity: number, onHand: number): number {
  if (kind === "purchase") return quantity;
  if (kind === "usage") return -quantity;
  return (toMilli(quantity) - toMilli(onHand)) / 1000; // adjustment: `quantity` is what was counted
}

export const applyChange = (onHand: number, change: number): number => (toMilli(onHand) + toMilli(change)) / 1000;

export const isLowStock = (quantity: number, minQuantity: number | null): boolean =>
  minQuantity !== null && quantity <= minQuantity;
