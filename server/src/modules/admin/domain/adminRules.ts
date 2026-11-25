/** Pure rules for the platform admin area — no I/O (Backend Guide §27). */

/** Stopping someone's access (suspend, disable) needs a reason this long, so the audit log explains it. */
export const STOP_REASON_MIN = 10;

/** Business fields that are contact details: the audit log records THAT they changed, never the values. */
const CONTACT_FIELDS = new Set(["email", "phone", "address"]);

/**
 * What an admin's edit changed, for the audit log: `{ from, to }` per field, except contact details,
 * which are `{ changed: true }` (the business email is often the owner's own address).
 */
export function auditedChanges<T extends object>(
  before: T,
  after: T,
  fields: (keyof T & string)[],
): Record<string, { from: unknown; to: unknown } | { changed: true }> {
  return Object.fromEntries(
    fields.map((field) => [
      field,
      CONTACT_FIELDS.has(field) ? { changed: true as const } : { from: before[field], to: after[field] },
    ]),
  );
}

/**
 * A business's currency is fixed once it has taken a payment: receipts, balances and reports
 * already recorded in it would silently change meaning.
 */
export function canChangeCurrency(current: string, next: string | undefined, hasPayments: boolean): boolean {
  return next === undefined || next === current || !hasPayments;
}
