/**
 * The same money rules the server applies to an order (server/src/modules/orders/domain/orderMoney.ts), so the
 * figures shown while typing are the figures that get saved. Everything is worked out in kobo.
 */
export type DiscountType = "amount" | "percent";

export interface PricedLine {
  quantity: number;
  /** The agreed price of one piece. 0 while there is only an estimate. */
  unitPrice: number;
  estimateMin?: number | null;
  estimateMax?: number | null;
  /** Taken off the whole line: a fixed amount, or a percentage of it. */
  discountType?: DiscountType | null;
  discountValue?: number | null;
}

const toMinor = (amount: number): number => Math.round(amount * 100);

function discountMinor(grossMinor: number, type?: DiscountType | null, value?: number | null): number {
  if (!type || !value || value <= 0) return 0;
  const raw = type === "percent" ? Math.round((grossMinor * value) / 100) : toMinor(value);
  return Math.min(raw, grossMinor);
}

const grossMinor = (line: PricedLine): number => toMinor(line.unitPrice) * line.quantity;

/** Has an estimate and no agreed price yet. */
export const isPending = (line: PricedLine): boolean => line.estimateMax != null && line.unitPrice <= 0;

/** What the discount takes off, at the agreed price. */
export const lineDiscount = (line: PricedLine): number =>
  discountMinor(grossMinor(line), line.discountType, line.discountValue) / 100;

/** quantity × price, less the discount. */
export const lineNet = (line: PricedLine): number =>
  (grossMinor(line) - discountMinor(grossMinor(line), line.discountType, line.discountValue)) / 100;

/** One line's estimate at one end, with the discount applied to it. */
function estimatedMinor(line: PricedLine, end: "min" | "max"): number {
  if (!isPending(line)) return toMinor(lineNet(line));
  const each = (end === "min" ? line.estimateMin : line.estimateMax) ?? 0;
  const gross = toMinor(each) * line.quantity;
  return gross - discountMinor(gross, line.discountType, line.discountValue);
}

export interface OrderFigures {
  /** The agreed prices, less discounts. Items still waiting for a price count as nothing. */
  total: number;
  discount: number;
  pending: boolean;
  /** The range the order could come to while a price is pending. */
  min: number;
  max: number;
}

export function orderFigures(lines: PricedLine[]): OrderFigures {
  return {
    total: lines.reduce((sum, line) => sum + toMinor(lineNet(line)), 0) / 100,
    discount: lines.reduce((sum, line) => sum + toMinor(lineDiscount(line)), 0) / 100,
    pending: lines.some(isPending),
    min: lines.reduce((sum, line) => sum + estimatedMinor(line, "min"), 0) / 100,
    max: lines.reduce((sum, line) => sum + estimatedMinor(line, "max"), 0) / 100,
  };
}
