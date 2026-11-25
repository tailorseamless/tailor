import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { AdoptionDTO, CohortDTO, DailyStatDTO } from "../dto/insights.dto";

const toInt = (value: unknown) => Number(value ?? 0);

/** A person doing something in a business (not a job, a customer or the public). */
const PERSON = `a.actor_kind = 'user'`;

/** The features adoption looks for, by the audit action that shows a business used them. */
const FEATURES: { key: string; label: string; where: string }[] = [
  { key: "measurements", label: "Measurements", where: `a.action = 'measurement.recorded'` },
  { key: "orders", label: "Orders", where: `a.action = 'order.created'` },
  { key: "payments", label: "Payments", where: `a.action = 'payment.recorded'` },
  { key: "appointments", label: "Appointments", where: `a.action = 'appointment.created'` },
  { key: "requests", label: "Online requests answered", where: `a.action = 'appointment_request.accepted'` },
  { key: "tasks", label: "Production tasks", where: `a.action = 'task.created'` },
  { key: "inventory", label: "Inventory", where: `left(a.action, 9) = 'material.'` },
  { key: "expenses", label: "Expenses", where: `a.action = 'expense.created'` },
  { key: "designs", label: "Design catalogue", where: `a.action = 'design.created'` },
  { key: "portal", label: "Customer portal links", where: `a.action = 'customer.portal_link_created'` },
  { key: "team", label: "Invited a team member", where: `a.action = 'team.member_added'` },
];

/** Weeks after sign-up at which retention is measured (activity in days 7N-7 to 7N). */
const RETENTION_WEEKS = [2, 4, 12];

/**
 * Growth and adoption figures. The daily rollup is the only heavy query and runs in a job; the rest
 * read the rollup or a bounded window of the audit log (indexed on created_at).
 */
export class InsightsRepository {
  static Instance = new InsightsRepository();

  private constructor() {}

  async latestStatDay(): Promise<string | null> {
    const [row] = await AppDataSource.query(`SELECT to_char(MAX(day), 'YYYY-MM-DD') AS day FROM platform_daily_stats`);
    return (row?.day as string | null) ?? null;
  }

  /** (Re)computes every UTC day from `from` to `to`, inclusive. Safe to repeat. */
  async rollup(from: string, to: string): Promise<number> {
    const rows: unknown[] = await AppDataSource.query(
      `INSERT INTO platform_daily_stats
              (day, businesses_total, businesses_new, businesses_active_7d, people_new, people_active_7d,
               orders_new, appointments_new, payments_new, emails_sent, emails_failed, computed_at)
       SELECT d::date,
              (SELECT COUNT(*) FROM businesses b WHERE b.created_at < w.e AND (b.deleted_at IS NULL OR b.deleted_at >= w.e)),
              (SELECT COUNT(*) FROM businesses b WHERE b.created_at >= w.s AND b.created_at < w.e),
              (SELECT COUNT(DISTINCT a.business_id) FROM audit_logs a
                WHERE ${PERSON} AND a.created_at >= w.s - interval '6 days' AND a.created_at < w.e),
              (SELECT COUNT(*) FROM users u WHERE u.created_at >= w.s AND u.created_at < w.e),
              (SELECT COUNT(DISTINCT a.actor_id) FROM audit_logs a
                WHERE ${PERSON} AND a.created_at >= w.s - interval '6 days' AND a.created_at < w.e),
              (SELECT COUNT(*) FROM orders o WHERE o.created_at >= w.s AND o.created_at < w.e),
              (SELECT COUNT(*) FROM appointments p WHERE p.created_at >= w.s AND p.created_at < w.e),
              (SELECT COUNT(*) FROM payments p WHERE p.created_at >= w.s AND p.created_at < w.e),
              (SELECT COUNT(*) FROM email_outbox e WHERE e.status = 'sent' AND e.sent_at >= w.s AND e.sent_at < w.e),
              (SELECT COUNT(*) FROM email_outbox e WHERE e.status = 'failed' AND e.updated_at >= w.s AND e.updated_at < w.e),
              now()
         FROM generate_series($1::date, $2::date, interval '1 day') AS d
         CROSS JOIN LATERAL (SELECT d AT TIME ZONE 'UTC' AS s, (d + interval '1 day') AT TIME ZONE 'UTC' AS e) AS w
       ON CONFLICT (day) DO UPDATE SET
              businesses_total = EXCLUDED.businesses_total, businesses_new = EXCLUDED.businesses_new,
              businesses_active_7d = EXCLUDED.businesses_active_7d, people_new = EXCLUDED.people_new,
              people_active_7d = EXCLUDED.people_active_7d, orders_new = EXCLUDED.orders_new,
              appointments_new = EXCLUDED.appointments_new, payments_new = EXCLUDED.payments_new,
              emails_sent = EXCLUDED.emails_sent, emails_failed = EXCLUDED.emails_failed, computed_at = now()
       RETURNING day`,
      [from, to],
    );
    return rows.length;
  }

  async dailyStats(days: number): Promise<DailyStatDTO[]> {
    const rows: Record<string, unknown>[] = await AppDataSource.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, businesses_total, businesses_new, businesses_active_7d,
              people_new, people_active_7d, orders_new, appointments_new, payments_new, emails_sent, emails_failed
         FROM platform_daily_stats WHERE day > CURRENT_DATE - $1::int ORDER BY day`,
      [days],
    );
    return rows.map((r) => ({
      day: r.day as string,
      businessesTotal: toInt(r.businesses_total),
      businessesNew: toInt(r.businesses_new),
      businessesActive7d: toInt(r.businesses_active_7d),
      peopleNew: toInt(r.people_new),
      peopleActive7d: toInt(r.people_active_7d),
      ordersNew: toInt(r.orders_new),
      appointmentsNew: toInt(r.appointments_new),
      paymentsNew: toInt(r.payments_new),
      emailsSent: toInt(r.emails_sent),
      emailsFailed: toInt(r.emails_failed),
    }));
  }

  /** Of the businesses where a person did anything in the last `days`, how many used each feature. */
  async adoption(days: number): Promise<AdoptionDTO> {
    const window = `a.created_at > now() - make_interval(days => $1)`;
    const [row] = await AppDataSource.query(
      `WITH active AS (
         SELECT DISTINCT a.business_id FROM audit_logs a WHERE ${PERSON} AND ${window} AND a.business_id IS NOT NULL
       )
       SELECT (SELECT COUNT(*) FROM active) AS active,
              ${FEATURES.map((f) => `COUNT(DISTINCT a.business_id) FILTER (WHERE ${f.where}) AS "${f.key}"`).join(",\n              ")},
              (SELECT COUNT(*) FROM businesses b WHERE b.id IN (SELECT business_id FROM active) AND b.page_enabled) AS "publicPage",
              (SELECT COUNT(*) FROM businesses b WHERE b.id IN (SELECT business_id FROM active)
                  AND b.page_enabled AND b.booking_enabled) AS "booking"
         FROM audit_logs a
        WHERE a.business_id IN (SELECT business_id FROM active) AND ${PERSON} AND ${window}`,
      [days],
    );
    return {
      days,
      activeBusinesses: toInt(row?.active),
      features: [
        ...FEATURES.map((f) => ({ key: f.key, label: f.label, businesses: toInt(row?.[f.key]) })),
        { key: "publicPage", label: "Public page published", businesses: toInt(row?.publicPage) },
        { key: "booking", label: "Online booking on", businesses: toInt(row?.booking) },
      ].sort((a, b) => b.businesses - a.businesses),
    };
  }

  /** Sign-up cohorts by week, newest first, with activation and retention. */
  async cohorts(weeks: number): Promise<CohortDTO[]> {
    const retention = RETENTION_WEEKS.map(
      (n) => `
         COUNT(*) FILTER (WHERE c.created_at + interval '${n * 7} days' <= now()) AS "eligible${n}",
         COUNT(*) FILTER (WHERE c.created_at + interval '${n * 7} days' <= now() AND EXISTS (
           SELECT 1 FROM audit_logs a WHERE a.business_id = c.id AND ${PERSON}
              AND a.created_at >= c.created_at + interval '${(n - 1) * 7} days'
              AND a.created_at < c.created_at + interval '${n * 7} days')) AS "retained${n}"`,
    );
    const rows: Record<string, unknown>[] = await AppDataSource.query(
      `WITH c AS (
         SELECT b.id, b.created_at, date_trunc('week', b.created_at) AS week FROM businesses b
          WHERE b.created_at >= date_trunc('week', now()) - make_interval(weeks => $1::int - 1)
       )
       SELECT to_char(c.week, 'YYYY-MM-DD') AS "weekStart", COUNT(*) AS size,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM orders o WHERE o.business_id = c.id AND o.created_at < c.created_at + interval '14 days'
              )) AS activated,
              ${retention.join(",")}
         FROM c GROUP BY c.week ORDER BY c.week DESC`,
      [weeks],
    );
    return rows.map((r) => ({
      weekStart: r.weekStart as string,
      size: toInt(r.size),
      activated: toInt(r.activated),
      retention: RETENTION_WEEKS.map((n) => ({
        week: n,
        eligible: toInt(r[`eligible${n}`]),
        retained: toInt(r[`retained${n}`]),
      })),
    }));
  }
}
