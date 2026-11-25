import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { DeliveryHealthDTO, FailedEmailDTO } from "../dto/system.dto";

const toInt = (value: unknown) => Number(value ?? 0);

/**
 * Platform-wide delivery figures for System health. Counts only: no addresses, no message contents.
 * Both outbox tables have a partial index on pending rows; the 24-hour window scans recent rows only.
 */
export class SystemHealthRepository {
  static Instance = new SystemHealthRepository();

  private constructor() {}

  async ping(): Promise<boolean> {
    try {
      await AppDataSource.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  private async delivery(table: "email_outbox" | "push_deliveries"): Promise<DeliveryHealthDTO> {
    const [row] = await AppDataSource.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'sent' AND updated_at > now() - interval '24 hours') AS sent,
              COUNT(*) FILTER (WHERE status = 'failed' AND updated_at > now() - interval '24 hours') AS failed,
              COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at > now() - interval '24 hours') AS cancelled,
              COUNT(*) FILTER (WHERE status = 'pending') AS pending,
              MIN(created_at) FILTER (WHERE status = 'pending') AS "oldestPendingAt"
         FROM ${table}
        WHERE status = 'pending' OR updated_at > now() - interval '24 hours'`,
    );
    return {
      last24h: { sent: toInt(row.sent), failed: toInt(row.failed), cancelled: toInt(row.cancelled) },
      pending: toInt(row.pending),
      oldestPendingAt: (row.oldestPendingAt as Date | null) ?? null,
    };
  }

  email(): Promise<DeliveryHealthDTO> {
    return this.delivery("email_outbox");
  }

  push(): Promise<DeliveryHealthDTO> {
    return this.delivery("push_deliveries");
  }

  /**
   * The size of the tables that grow without bound, so the admin can see when the audit log needs
   * partitioning or archiving (planned at ~10 million rows). Row counts are Postgres's estimate
   * (instant, no scan), accurate after the table's last ANALYZE.
   */
  async growingTables(): Promise<{ name: string; rows: number; bytes: number }[]> {
    const rows: { name: string; rows: string; bytes: string }[] = await AppDataSource.query(
      `SELECT c.relname AS name, GREATEST(c.reltuples, 0)::bigint AS rows, pg_total_relation_size(c.oid) AS bytes
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind = 'r'
          AND c.relname IN ('audit_logs', 'notifications', 'email_outbox', 'push_deliveries', 'security_counters')
        ORDER BY pg_total_relation_size(c.oid) DESC`,
    );
    return rows.map((row) => ({ name: row.name, rows: toInt(row.rows), bytes: toInt(row.bytes) }));
  }

  /** The latest emails that gave up, newest first: kind and error only. */
  recentEmailFailures(limit = 10): Promise<FailedEmailDTO[]> {
    return AppDataSource.query(
      `SELECT id, kind, attempts, last_error AS "lastError", updated_at AS "updatedAt"
         FROM email_outbox WHERE status = 'failed' ORDER BY updated_at DESC LIMIT $1`,
      [limit],
    );
  }
}
