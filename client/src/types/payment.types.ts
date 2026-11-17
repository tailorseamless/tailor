import type { ISODate } from "./api.types";

export type PaymentKind = "payment" | "refund" | "void";
export type PaymentMethod = "cash" | "bank_transfer" | "pos" | "other";

export interface Payment {
  id: string;
  orderId: string;
  kind: PaymentKind;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: ISODate;
  note: string | null;
  receiptNumber: string | null;
  voided: boolean;
  orderNumber: string;
  customerName: string;
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
  reference?: string | null;
  note?: string | null;
}

export interface PaymentSummary {
  totalAmount: number;
  amountPaid: number;
  balance: number;
  currency: string;
}
