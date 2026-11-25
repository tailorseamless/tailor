import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { ONBOARDING_STEPS, type OnboardingState } from "../../users/dto/user.dto";
import { BASELINE_DAYS, type AnomalyGroup, type ChurnInput } from "../domain/riskRules";

const toInt = (value: unknown) => Number(value ?? 0);

/** Which audit actions belong to which anomaly group (SQL CASE). */
const GROUP_CASE = `CASE
    WHEN a.action IN ('payment.voided', 'payment.refunded') THEN 'payment_reversals'
    WHEN a.action = 'customer.deleted' THEN 'customer_deletions'
    WHEN a.action = 'measurement.deleted' THEN 'measurement_deletions'
    WHEN a.action = 'order.status_changed' AND a.payload->>'to' = 'cancelled' THEN 'order_cancellations'
  END`;

const WATCHED = `(a.action IN ('payment.voided', 'payment.refunded', 'customer.deleted', 'measurement.deleted')
    OR (a.action = 'order.status_changed' AND a.payload->>'to' = 'cancelled'))`;

export interface AnomalyRow {
  businessId: string;
  name: string;
  group: AnomalyGroup;
  last24h: number;
  /** Over the BASELINE_DAYS before the last 24 hours (zero days included by the caller). */
  sum: number;
  sumOfSquares: number;
}

export interface ChurnRow extends ChurnInput {
  businessId: string;
  name: string;
  createdAt: Date;
  ownerEmail: string | null;
}

/** The data behind anomaly detection and churn risk. Counts only; one bounded scan of the audit log each. */
export class RiskRepository {
  static Instance = new RiskRepository();

  private constructor() {}

  /**
   * For every live business with watched activity in the last 24 hours: that count, and the sum and
   * sum of squares of its daily counts over the baseline before it (missing days are zeros).
   */
  async anomalyCandidates(): Promise<AnomalyRow[]> {
    const rows: Record<string, unknown>[] = await AppDataSource.query(
      `WITH watched AS (
         SELECT a.business_id, a.created_at, ${GROUP_CASE} AS grp
           FROM audit_logs a
          WHERE a.business_id IS NOT NULL AND ${WATCHED}
            AND a.created_at > now() - make_interval(days => $1::int + 1)
       ),
       recent AS (
         SELECT business_id, grp, COUNT(*) AS n FROM watched
          WHERE created_at > now() - interval '1 day' GROUP BY business_id, grp
       ),
       daily AS (
         SELECT business_id, grp, date_trunc('day', created_at) AS day, COUNT(*) AS n FROM watched
          WHERE created_at <= now() - interval '1 day' GROUP BY business_id, grp, date_trunc('day', created_at)
       ),
       baseline AS (
         SELECT business_id, grp, SUM(n) AS total, SUM(n * n) AS squares FROM daily GROUP BY business_id, grp
       )
       SELECT r.business_id AS "businessId", b.name, r.grp, r.n AS last24h,
              COALESCE(bl.total, 0) AS total, COALESCE(bl.squares, 0) AS squares
         FROM recent r
         JOIN businesses b ON b.id = r.business_id AND b.deleted_at IS NULL AND b.status = 'active'
         LEFT JOIN baseline bl ON bl.business_id = r.business_id AND bl.grp = r.grp`,
      [BASELINE_DAYS],
    );
    return rows.map((row) => ({
      businessId: row.businessId as string,
      name: row.name as string,
      group: row.grp as AnomalyGroup,
      last24h: toInt(row.last24h),
      sum: toInt(row.total),
      sumOfSquares: toInt(row.squares),
    }));
  }

  /**
   * The churn inputs for live businesses at least `minAgeDays` old (younger ones are still setting
   * up), or for one business when `businessId` is given (any age).
   */
  async churnInputs(options: { minAgeDays: number; businessId?: string }): Promise<ChurnRow[]> {
    const args: unknown[] = [options.minAgeDays];
    let scope = `b.created_at < now() - make_interval(days => $1::int)`;
    if (options.businessId) {
      args.push(options.businessId);
      scope = `b.id = $2`;
    }
    const rows: Record<string, unknown>[] = await AppDataSource.query(
      `WITH people AS (
         SELECT a.business_id,
                COUNT(*) FILTER (WHERE a.created_at > now() - interval '14 days') AS recent,
                COUNT(*) FILTER (WHERE a.created_at <= now() - interval '14 days') AS previous
           FROM audit_logs a
          WHERE a.actor_kind = 'user' AND a.created_at > now() - interval '28 days'
          GROUP BY a.business_id
       )
       SELECT b.id AS "businessId", b.name, b.created_at AS "createdAt", o.email AS "ownerEmail", o.onboarding,
              COALESCE(p.recent, 0) AS recent, COALESCE(p.previous, 0) AS previous,
              (SELECT EXTRACT(DAY FROM now() - MAX(a.created_at))::int FROM audit_logs a
                WHERE a.business_id = b.id AND a.actor_kind = 'user') AS idle,
              (SELECT COUNT(*) FROM orders r WHERE r.business_id = b.id AND r.deleted_at IS NULL
                  AND r.created_at > now() - interval '30 days') AS orders,
              (SELECT COUNT(*) FROM business_members m JOIN users u ON u.id = m.user_id
                WHERE m.business_id = b.id AND m.deleted_at IS NULL AND m.status = 'active'
                  AND u.deleted_at IS NULL AND u.firebase_uid IS NOT NULL) AS signed_in
         FROM businesses b
         LEFT JOIN people p ON p.business_id = b.id
         LEFT JOIN business_members om ON om.business_id = b.id AND om.role = 'owner' AND om.deleted_at IS NULL
         LEFT JOIN users o ON o.id = om.user_id
        WHERE b.deleted_at IS NULL AND b.status = 'active' AND ${scope}`,
      args,
    );
    return rows.map((row) => {
      const guide = row.onboarding as OnboardingState | null;
      return {
        businessId: row.businessId as string,
        name: row.name as string,
        createdAt: row.createdAt as Date,
        ownerEmail: (row.ownerEmail as string | null) ?? null,
        daysSinceActivity: row.idle === null ? null : toInt(row.idle),
        recentEvents: toInt(row.recent),
        previousEvents: toInt(row.previous),
        ordersLast30Days: toInt(row.orders),
        onboarding: guide
          ? { done: guide.completed?.length ?? 0, total: ONBOARDING_STEPS.length, dismissed: guide.dismissed === true }
          : null,
        peopleSignedIn: toInt(row.signed_in),
      };
    });
  }
}
