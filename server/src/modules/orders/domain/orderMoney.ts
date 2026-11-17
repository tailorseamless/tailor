/** Money and numbering rules for orders — pure, no I/O. */

const toMinor = (amount: number): number => Math.round(amount * 100);

/** quantity × unit price, computed in minor units (kobo) so 0.1 + 0.2 never drifts. */
export function lineTotal(item: { quantity: number; unitPrice: number }): number {
  return (toMinor(item.unitPrice) * item.quantity) / 100;
}

export function orderTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + toMinor(item.unitPrice) * item.quantity, 0) / 100;
}

/** `TF-2026-000125`: the business's running order count, with the year it was taken in. */
export function formatOrderNumber(sequence: number, year: string): string {
  return `TF-${year}-${String(sequence).padStart(6, "0")}`;
}
