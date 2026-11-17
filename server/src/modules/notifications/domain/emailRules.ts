import { EMAIL } from "../../../config/constants";
import type { EmailKind } from "../dto/email.dto";

/** Delivery rules for the email outbox — pure, no I/O. */

/** Domains that can never receive mail — demo and test accounts never email. */
const RESERVED = /\.(local|localhost|test|invalid|example)$|(^|\.)example\.(com|org|net)$/i;

export function canReceiveEmail(address: string): boolean {
  const domain = address.split("@")[1] ?? "";
  return domain.length > 0 && !RESERVED.test(domain);
}

/** Old mail is cancelled, not sent late. Receipts carry the PDF and stay useful longer. */
export function isTooOld(kind: EmailKind, createdAt: Date, now: Date): boolean {
  const hours = kind === "receipt" ? EMAIL.receiptMaxAgeHours : EMAIL.maxAgeHours;
  return now.getTime() - createdAt.getTime() > hours * 3_600_000;
}

/** After the nth failed attempt: retry in 2ⁿ minutes, or give up (null). */
export function nextRetry(attemptsSoFar: number, now: Date): Date | null {
  const attempts = attemptsSoFar + 1;
  if (attempts >= EMAIL.maxAttempts) return null;
  return new Date(now.getTime() + 2 ** attempts * 60_000);
}
