import type { PaymentMethod } from "../../payments/dto/payment.dto";

/** What the business spends on (PRD §4.6). */
export const EXPENSE_CATEGORIES = [
  "materials",
  "rent",
  "electricity",
  "transport",
  "wages",
  "equipment",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_LIMITS = { maxAmount: 999_999_999 } as const;

/** Money the business spent. Belongs to the business, not to an order. */
export interface ExpenseRecord {
  id: string;
  businessId: string;
  /** NULL = the business as a whole. */
  branchId: string | null;
  category: ExpenseCategory;
  amount: number;
  /** `YYYY-MM-DD` */
  spentOn: string;
  description: string;
  method: PaymentMethod;
  reference: string | null;
  recordedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListExpensesParams {
  businessId: string;
  page: number;
  limit: number;
  category?: ExpenseCategory;
  branchId?: string;
  /** `spent_on` range, both inclusive. */
  from?: string;
  to?: string;
  search?: string;
}

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  total: number;
  count: number;
}
