/** Money and numbering rules for orders — pure, no I/O. */

const toMinor = (amount: number): number => Math.round(amount * 100);

export const DISCOUNT_TYPES = ["amount", "percent"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** What the money rules need to know about one garment. */
export interface PricedItem {
  quantity: number;
  /** The agreed price of ONE piece. 0 while it is still only an estimate. */
  unitPrice: number;
  /** A quote for ONE piece, before the price is agreed. Both or neither. */
  estimateMin?: number | null;
  estimateMax?: number | null;
  /** Taken off the whole line (all pieces together): a fixed amount, or a percentage of the line. */
  discountType?: DiscountType | null;
  discountValue?: number | null;
}

/** The discount in kobo, never more than the line itself. */
function discountMinor(grossMinor: number, type?: DiscountType | null, value?: number | null): number {
  if (!type || !value || value <= 0) return 0;
  const raw = type === "percent" ? Math.round((grossMinor * value) / 100) : toMinor(value);
  return Math.min(raw, grossMinor);
}

const grossMinor = (item: PricedItem): number => toMinor(item.unitPrice) * item.quantity;
const netMinor = (item: PricedItem): number =>
  grossMinor(item) - discountMinor(grossMinor(item), item.discountType, item.discountValue);

/** An item with an estimate and no agreed price yet: it adds nothing to the total until the price is set. */
export const isPricePending = (item: PricedItem): boolean => item.estimateMax != null && item.unitPrice <= 0;

/** What the discount takes off this line, at the agreed price. */
export function discountAmount(item: PricedItem): number {
  return discountMinor(grossMinor(item), item.discountType, item.discountValue) / 100;
}

/** quantity × unit price, less the discount, in kobo so 0.1 + 0.2 never drifts. */
export function lineTotal(item: PricedItem): number {
  return netMinor(item) / 100;
}

/** The total of the agreed prices. Items still waiting for their price count as nothing. */
export function orderTotal(items: PricedItem[]): number {
  return items.reduce((sum, item) => sum + netMinor(item), 0) / 100;
}

/** Total discount across the order. */
export function orderDiscount(items: PricedItem[]): number {
  return (
    items.reduce((sum, item) => sum + discountMinor(grossMinor(item), item.discountType, item.discountValue), 0) / 100
  );
}

/** A pending item priced at one end of its estimate, with its discount applied to that amount. */
function estimatedMinor(item: PricedItem, end: "min" | "max"): number {
  if (!isPricePending(item)) return netMinor(item);
  const each = (end === "min" ? item.estimateMin : item.estimateMax) ?? 0;
  const gross = toMinor(each) * item.quantity;
  return gross - discountMinor(gross, item.discountType, item.discountValue);
}

/** The most the order could come to while some item still awaits its price. null once every price is agreed. */
export function estimatedMaxTotal(items: PricedItem[]): number | null {
  if (!items.some(isPricePending)) return null;
  return items.reduce((sum, item) => sum + estimatedMinor(item, "max"), 0) / 100;
}

/** The least it could come to, on the same basis. null once every price is agreed. */
export function estimatedMinTotal(items: PricedItem[]): number | null {
  if (!items.some(isPricePending)) return null;
  return items.reduce((sum, item) => sum + estimatedMinor(item, "min"), 0) / 100;
}

/** `TF-2026-000125`: the business's running order count, with the year it was taken in. */
export function formatOrderNumber(sequence: number, year: string): string {
  return `TF-${year}-${String(sequence).padStart(6, "0")}`;
}
