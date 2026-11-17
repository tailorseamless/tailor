/**
 * Money arithmetic in minor units (kobo, cents), so sums and differences of
 * two-decimal amounts never drift. Amounts are stored as numeric(14,2).
 */
export const toMinor = (amount: number): number => Math.round(amount * 100);
export const fromMinor = (minor: number): number => minor / 100;

/** a − b, exactly. */
export const subtractMoney = (a: number, b: number): number => fromMinor(toMinor(a) - toMinor(b));

/** a + b, exactly. */
export const addMoney = (a: number, b: number): number => fromMinor(toMinor(a) + toMinor(b));

/** Negative, zero or positive as a is less than, equal to or greater than b. */
export const compareMoney = (a: number, b: number): number => toMinor(a) - toMinor(b);
