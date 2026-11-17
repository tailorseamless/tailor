import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { calendarDate, idParams, optionalText, trimmed } from "../../../shared/utils/zod";
import { PAYMENT_METHODS } from "../../payments/dto/payment.dto";
import { EXPENSE_CATEGORIES, EXPENSE_LIMITS } from "../dto/expense.dto";

const amount = z
  .number()
  .positive()
  .max(EXPENSE_LIMITS.maxAmount)
  .transform((value) => Math.round(value * 100) / 100)
  .refine((value) => value > 0, "Enter an amount greater than zero");

/** A real day that has already happened (allowing for time zones ahead of the server). */
const spentOn = calendarDate.refine(
  (day) => Date.parse(`${day}T00:00:00Z`) <= Date.now() + 86_400_000,
  "Enter a date that is not in the future",
);

const expenseFields = {
  /** NULL = the business as a whole. */
  branchId: z.string().uuid().nullable(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount,
  spentOn,
  description: trimmed(2, 300),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(100),
};

export const listExpensesSchema = z.object({
  query: z
    .object({
      ...paginationQuery,
      category: z.enum(EXPENSE_CATEGORIES).optional(),
      branchId: z.string().uuid().optional(),
      from: calendarDate.optional(),
      to: calendarDate.optional(),
      search: z.string().trim().min(1).max(100).optional(),
    })
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
      message: "Must not be before from",
      path: ["to"],
    }),
});

export const expenseIdSchema = z.object({ params: idParams("id") });

export const createExpenseSchema = z.object({
  body: z.object({
    ...expenseFields,
    branchId: expenseFields.branchId.optional(),
    /** Defaults to today where the person recording it is. */
    spentOn: spentOn.optional(),
    method: expenseFields.method.default("cash"),
  }),
});

export const updateExpenseSchema = z.object({
  params: idParams("id"),
  body: z
    .object(expenseFields)
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export type ListExpensesQuery = z.infer<typeof listExpensesSchema>["query"];
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>["body"];
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>["body"];
