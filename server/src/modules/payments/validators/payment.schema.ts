import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { email, idParams, isoDateTime, optionalText, trimmed, uuid } from "../../../shared/utils/zod";
import { PAYMENT_KINDS, PAYMENT_LIMITS, PAYMENT_METHODS } from "../dto/payment.dto";

/** More than nothing, at most two decimals. */
const amount = z
  .number()
  .positive()
  .max(PAYMENT_LIMITS.maxAmount)
  .transform((value) => Math.round(value * 100) / 100)
  .refine((value) => value > 0, "Enter an amount greater than zero");

/** When the money changed hands. Defaults to now; never in the future. */
const paidAt = isoDateTime
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() <= Date.now() + 5 * 60_000, "Enter a time that is not in the future");

const entryBody = {
  amount,
  method: z.enum(PAYMENT_METHODS),
  paidAt: paidAt.optional(),
  reference: optionalText(100),
};

export const recordPaymentSchema = z.object({
  params: idParams("orderId"),
  body: z.object({ ...entryBody, note: optionalText(500) }),
});

export const recordRefundSchema = z.object({
  params: idParams("orderId"),
  // A refund always says why.
  body: z.object({ ...entryBody, note: trimmed(3, 500) }),
});

export const voidPaymentSchema = z.object({
  params: idParams("id"),
  body: z.object({ reason: trimmed(3, 500) }),
});

export const paymentIdSchema = z.object({ params: idParams("id") });

export const emailReceiptSchema = z.object({
  params: idParams("id"),
  /** Defaults to the customer's own address. */
  body: z.object({ to: email.optional() }),
});

const listQuery = {
  ...paginationQuery,
  branchId: uuid.optional(),
  kind: z.enum(PAYMENT_KINDS).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  from: isoDateTime.transform((value) => new Date(value)).optional(),
  to: isoDateTime.transform((value) => new Date(value)).optional(),
};

export const listPaymentsSchema = z.object({
  query: z.object({ ...listQuery, orderId: uuid.optional(), customerId: uuid.optional() }),
});

export const listOrderPaymentsSchema = z.object({
  params: idParams("orderId"),
  query: z.object(listQuery),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>["body"];
export type RecordRefundInput = z.infer<typeof recordRefundSchema>["body"];
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>["body"];
export type ListPaymentsQuery = z.infer<typeof listPaymentsSchema>["query"];
export type ListOrderPaymentsQuery = z.infer<typeof listOrderPaymentsSchema>["query"];
