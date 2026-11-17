import { compareMoney, subtractMoney } from "../../../shared/utils/money";

/** Payment rules — pure, no I/O (Backend Guide §27.3). */

/**
 * SQL for "net amount received" on the order aliased `o`: payments minus
 * refunds, ignoring void entries and the entries they cancelled. The single
 * definition — every query that needs a paid amount or balance uses it.
 */
export const NET_PAID_FOR_ORDER = `(SELECT COALESCE(SUM(CASE p.kind WHEN 'payment' THEN p.amount ELSE -p.amount END), 0)
     FROM payments p
    WHERE p.order_id = o.id
      AND p.kind <> 'void'
      AND NOT EXISTS (SELECT 1 FROM payments v WHERE v.reverses_payment_id = p.id))`;

/** What the customer still owes. A cancelled order is owed nothing. */
export function balanceDue(cancelled: boolean, totalAmount: number, amountPaid: number): number {
  if (cancelled) return 0;
  const balance = subtractMoney(totalAmount, amountPaid);
  return balance > 0 ? balance : 0;
}

/** A payment may not take the order past fully paid (PRD US-034). */
export const exceedsBalance = (amount: number, balance: number): boolean => compareMoney(amount, balance) > 0;

/** A refund may not give back more than was received. */
export const exceedsPaid = (amount: number, amountPaid: number): boolean => compareMoney(amount, amountPaid) > 0;

/** `RCT-2026-000041` */
export function formatReceiptNumber(sequence: number, year: string): string {
  return `RCT-${year}-${String(sequence).padStart(6, "0")}`;
}
