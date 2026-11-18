/** "₦40,000.20" — in the business's currency. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** A price for display: whole amounts without ".00" ("₦45,000"), kobo only when there are some. */
export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/**
 * A design's price range as a customer reads it: "₦45,000 – ₦70,000", "₦45,000" when both ends match,
 * "From ₦45,000" or "Up to ₦70,000" when one end is open. Null when the tailor set no price.
 */
export function formatPriceRange(min: number | null, max: number | null, currency: string): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return min === max ? formatPrice(min, currency) : `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
  }
  return min !== null ? `From ${formatPrice(min, currency)}` : `Up to ${formatPrice(max as number, currency)}`;
}

/** Sums two-decimal amounts without floating-point drift. */
export function sumMoney(values: number[]): number {
  return values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;
}
