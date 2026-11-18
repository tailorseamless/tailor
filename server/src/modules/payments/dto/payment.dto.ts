/**
 * `payment` — money received. `refund` — money given back.
 * `void` — cancels one earlier entry that was recorded by mistake.
 * Entries are never edited or deleted; a correction is a new entry (PRD §3.5).
 */
export const PAYMENT_KINDS = ["payment", "refund", "void"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ["cash", "bank_transfer", "pos", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LIMITS = { maxAmount: 999_999_999 } as const;

export interface PaymentRecord {
  id: string;
  businessId: string;
  orderId: string;
  customerId: string;
  kind: PaymentKind;
  /** Always positive; `kind` says which way the money moved. */
  amount: number;
  method: PaymentMethod;
  /** Transfer reference, POS slip number… */
  reference: string | null;
  paidAt: Date;
  note: string | null;
  /** e.g. RCT-2026-000041. Voids have none. */
  receiptNumber: string | null;
  /** For a `void`: the entry it cancels. */
  reversesPaymentId: string | null;
  recordedBy: string | null;
  createdAt: Date;
  /** A later `void` entry cancelled this one; it no longer counts. */
  voided: boolean;
}

export interface PaymentListItemDTO extends PaymentRecord {
  orderNumber: string;
  customerName: string;
}

/** Where an order stands. Always derived from the entries, never stored (PRD BR-009). */
export interface PaymentSummary {
  totalAmount: number;
  amountPaid: number;
  balance: number;
  /** An item still has only an estimate: the total is not final and deposits may go up to the estimate. */
  pricePending: boolean;
  estimatedMaxTotal: number | null;
  currency: string;
}

export interface PaymentResultDTO {
  payment: PaymentRecord;
  summary: PaymentSummary;
}

export interface ReceiptDTO {
  receiptNumber: string;
  kind: "payment" | "refund";
  voided: boolean;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  paidAt: Date;
  note: string | null;
  business: { name: string; phone: string | null; email: string | null; address: string | null; timeZone: string };
  customer: { fullName: string; phone: string; email: string | null } | null;
  order: { id: string; orderNumber: string } & Omit<PaymentSummary, "currency">;
}

export interface ListPaymentsParams {
  businessId: string;
  page: number;
  limit: number;
  orderId?: string;
  customerId?: string;
  /** Payments on orders of this branch. */
  branchId?: string;
  kind?: PaymentKind;
  method?: PaymentMethod;
  /** `paid_at` range, inclusive start / exclusive end. */
  from?: Date;
  to?: Date;
}
