import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { NET_PAID_FOR_ORDER } from "../../payments/domain/paymentRules";
import type { OrderStatusRow, PeriodParams } from "../dto/dashboard.dto";

/**
 * Read-only aggregates across modules. Every query is scoped by business_id
 * first and filters soft deletes by hand — raw SQL does not do it for us
 * (Backend Guide §8.3). `from`/`to` are calendar days in the business's zone:
 *   start = midnight of `from` in that zone, end = midnight after `to`.
 */
const PERIOD_START = `($2::date::timestamp AT TIME ZONE $4)`;
const PERIOD_END = `(($3::date + 1)::timestamp AT TIME ZONE $4)`;

const inPeriod = (column: string) => `${column} >= ${PERIOD_START} AND ${column} < ${PERIOD_END}`;
const periodArgs = (p: PeriodParams) => [p.businessId, p.from, p.to, p.timeZone];

export class DashboardRepository {
  static Instance = new DashboardRepository();

  private constructor() {}

  /** Index: customers(business_id, created_at). */
  async customerCounts(params: PeriodParams): Promise<{ total: number; newInPeriod: number }> {
    const rows: { total: number; newInPeriod: number }[] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ${inPeriod("created_at")})::int AS "newInPeriod"
         FROM customers
        WHERE business_id = $1 AND deleted_at IS NULL`,
      periodArgs(params),
    );
    return rows[0] ?? { total: 0, newInPeriod: 0 };
  }

  /** One pass over the business's orders, grouped by status. Index: orders(business_id, status). */
  async orderStatusRows(params: PeriodParams, today: string): Promise<OrderStatusRow[]> {
    const rows: (Omit<OrderStatusRow, "valueInPeriod"> & { valueInPeriod: string })[] = await AppDataSource.query(
      `SELECT status,
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE due_date < $5::date)::int AS "pastDue",
              COUNT(*) FILTER (WHERE ${inPeriod("created_at")})::int AS "createdInPeriod",
              COUNT(*) FILTER (WHERE ${inPeriod("delivered_at")})::int AS "deliveredInPeriod",
              COALESCE(SUM(total_amount) FILTER (WHERE ${inPeriod("created_at")}), 0) AS "valueInPeriod"
         FROM orders
        WHERE business_id = $1 AND deleted_at IS NULL AND ($6::uuid IS NULL OR branch_id = $6)
        GROUP BY status`,
      [...periodArgs(params), today, params.branchId],
    );
    return rows.map((row) => ({ ...row, valueInPeriod: Number(row.valueInPeriod) }));
  }

  /**
   * Cash in and out by PAYMENT date, without void entries or the entries they
   * cancelled. Index: payments(business_id, paid_at).
   */
  async paymentsInPeriod(params: PeriodParams): Promise<{ received: number; refunded: number }> {
    const rows: { received: string; refunded: string }[] = await AppDataSource.query(
      `SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'payment'), 0) AS received,
              COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'refund'), 0) AS refunded
         FROM payments p
        WHERE p.business_id = $1
          AND p.kind <> 'void'
          AND ${inPeriod("p.paid_at")}
          AND NOT EXISTS (SELECT 1 FROM payments v WHERE v.reverses_payment_id = p.id)
          AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM orders o WHERE o.id = p.order_id AND o.branch_id = $5))`,
      [...periodArgs(params), params.branchId],
    );
    return { received: Number(rows[0]?.received ?? 0), refunded: Number(rows[0]?.refunded ?? 0) };
  }

  /**
   * What customers still owe on every order that is not cancelled — derived
   * from the ledger, never from a stored figure (PRD BR-009).
   */
  async outstanding(businessId: string, branchId: string | null = null): Promise<{ balance: number; orders: number }> {
    const rows: { balance: string; orders: number }[] = await AppDataSource.query(
      `SELECT COALESCE(SUM(t.owed), 0) AS balance, COUNT(*)::int AS orders
         FROM (SELECT o.total_amount - ${NET_PAID_FOR_ORDER} AS owed
                 FROM orders o
                WHERE o.business_id = $1 AND o.deleted_at IS NULL AND o.status <> 'cancelled'
                  AND ($2::uuid IS NULL OR o.branch_id = $2)) t
        WHERE t.owed > 0`,
      [businessId, branchId],
    );
    return { balance: Number(rows[0]?.balance ?? 0), orders: rows[0]?.orders ?? 0 };
  }
}
