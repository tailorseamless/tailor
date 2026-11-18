import type { ExpenseCategoryTotal } from "../../expenses/dto/expense.dto";

export const REPORTS = { topGarments: 20 } as const;

export interface ReportPeriod {
  /** Inclusive days, in the business's time zone. */
  from: string;
  to: string;
  timeZone: string;
}

export interface MonthFigures {
  /** `YYYY-MM` */
  month: string;
  /** Payments − refunds, by payment date. */
  netReceived: number;
  expenses: number;
  /** netReceived − expenses. */
  net: number;
}

/**
 * Income and expenses (PRD US-052). Sales value, cash received and profit are
 * different things and are reported separately (PRD §3.9).
 */
export interface IncomeExpensesDTO {
  period: ReportPeriod;
  currency: string;
  /** Total of the (non-cancelled) orders taken in the period. NOT cash. */
  orderValue: number;
  received: number;
  refunded: number;
  netReceived: number;
  expenses: { total: number; byCategory: ExpenseCategoryTotal[] };
  /**
   * netReceived − expenses: cash in minus cash out. An estimate — it is not
   * accounting profit (no stock valuation, no amounts still owed).
   */
  estimatedProfit: number;
  byMonth: MonthFigures[];
}

export interface GarmentSales {
  garmentName: string;
  /** Pieces ordered. */
  quantity: number;
  orders: number;
  /** quantity × unit price, less discounts, summed. */
  value: number;
}

export interface GarmentSalesDTO {
  period: ReportPeriod;
  currency: string;
  garments: GarmentSales[];
}

export interface PeriodArgs extends ReportPeriod {
  businessId: string;
  /** NULL = the whole business. */
  branchId: string | null;
}
