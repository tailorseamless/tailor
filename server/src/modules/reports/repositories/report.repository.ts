import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { REPORTS, type GarmentSales, type PeriodArgs } from "../dto/report.dto";

/**
 * Read-only aggregates. Every query is scoped by business_id first and
 * filters soft deletes by hand — raw SQL does not do it for us (Backend
 * Guide §8.3). `from`/`to` are calendar days in the business's zone.
 */
const PERIOD_START = `($2::date::timestamp AT TIME ZONE $4)`;
const PERIOD_END = `(($3::date + 1)::timestamp AT TIME ZONE $4)`;
const inPeriod = (column: string) => `${column} >= ${PERIOD_START} AND ${column} < ${PERIOD_END}`;
const args = (p: PeriodArgs) => [p.businessId, p.from, p.to, p.timeZone];

export class ReportRepository {
  static Instance = new ReportRepository();

  private constructor() {}

  /**
   * Cash in minus refunds per calendar month (in the business's zone), without
   * void entries or the entries they cancelled. Index: payments(business_id, paid_at).
   */
  async cashByMonth(params: PeriodArgs): Promise<{ month: string; netReceived: number }[]> {
    const rows: { month: string; netReceived: string }[] = await AppDataSource.query(
      `SELECT to_char(p.paid_at AT TIME ZONE $4, 'YYYY-MM') AS month,
              SUM(CASE p.kind WHEN 'payment' THEN p.amount ELSE -p.amount END) AS "netReceived"
         FROM payments p
        WHERE p.business_id = $1
          AND p.kind <> 'void'
          AND ${inPeriod("p.paid_at")}
          AND NOT EXISTS (SELECT 1 FROM payments v WHERE v.reverses_payment_id = p.id)
          AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM orders o WHERE o.id = p.order_id AND o.branch_id = $5))
        GROUP BY 1`,
      [...args(params), params.branchId],
    );
    return rows.map((row) => ({ month: row.month, netReceived: Number(row.netReceived) }));
  }

  /** Spending per calendar month. Index: expenses(business_id, spent_on). */
  async expensesByMonth(params: PeriodArgs): Promise<{ month: string; expenses: number }[]> {
    const rows: { month: string; expenses: string }[] = await AppDataSource.query(
      `SELECT to_char(spent_on, 'YYYY-MM') AS month, SUM(amount) AS expenses
         FROM expenses
        WHERE business_id = $1 AND deleted_at IS NULL AND spent_on >= $2::date AND spent_on <= $3::date
          AND ($4::uuid IS NULL OR branch_id = $4)
        GROUP BY 1`,
      [params.businessId, params.from, params.to, params.branchId],
    );
    return rows.map((row) => ({ month: row.month, expenses: Number(row.expenses) }));
  }

  /**
   * Which garments bring in the most (PRD §3.9), from the orders TAKEN in the
   * period, cancelled ones left out. Names are grouped ignoring case.
   * Index: orders(business_id, created_at), order_items(order_id, position).
   */
  async garmentSales(params: PeriodArgs): Promise<GarmentSales[]> {
    const rows: (Omit<GarmentSales, "value"> & { value: string })[] = await AppDataSource.query(
      `SELECT MIN(i.garment_name) AS "garmentName",
              SUM(i.quantity)::int AS quantity,
              COUNT(DISTINCT o.id)::int AS orders,
              SUM(i.quantity * i.unit_price - i.discount_amount) AS value
         FROM orders o
         JOIN order_items i ON i.order_id = o.id AND i.deleted_at IS NULL
        WHERE o.business_id = $1
          AND o.deleted_at IS NULL
          AND o.status <> 'cancelled'
          AND ${inPeriod("o.created_at")}
          AND ($5::uuid IS NULL OR o.branch_id = $5)
        GROUP BY LOWER(i.garment_name)
        ORDER BY SUM(i.quantity * i.unit_price - i.discount_amount) DESC, MIN(i.garment_name)
        LIMIT ${REPORTS.topGarments}`,
      [...args(params), params.branchId],
    );
    return rows.map((row) => ({ ...row, value: Number(row.value) }));
  }
}
