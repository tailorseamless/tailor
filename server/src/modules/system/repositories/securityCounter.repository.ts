import { AppDataSource } from "../../../infrastructure/database/dataSource";

const toInt = (value: unknown) => Number(value ?? 0);

export class SecurityCounterRepository {
  static Instance = new SecurityCounterRepository();

  private constructor() {}

  /**
   * Stores the running count for a window. Several servers may count the same window; the largest
   * count each has seen wins (an undercount, never an overcount, when they overlap).
   */
  async record(entry: { windowStart: Date; kind: string; ip: string; count: number; userId: string | null }) {
    await AppDataSource.query(
      `INSERT INTO security_counters (window_start, kind, ip, count, last_user_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (window_start, kind, ip) DO UPDATE SET
              count = GREATEST(security_counters.count, EXCLUDED.count),
              last_user_id = COALESCE(EXCLUDED.last_user_id, security_counters.last_user_id),
              updated_at = now()`,
      [entry.windowStart, entry.kind, entry.ip.slice(0, 64), entry.count, entry.userId],
    );
  }

  /** Totals per kind over the last 24 hours. */
  async totals24h(): Promise<Record<string, number>> {
    const rows: { kind: string; n: string }[] = await AppDataSource.query(
      `SELECT kind, SUM(count) AS n FROM security_counters
        WHERE window_start > now() - interval '24 hours' GROUP BY kind`,
    );
    return Object.fromEntries(rows.map((row) => [row.kind, toInt(row.n)]));
  }

  /** The addresses behind the most refusals in the last 24 hours (technical admins only). */
  async topSources(limit = 10): Promise<{ kind: string; ip: string; count: number; lastAt: Date }[]> {
    const rows: { kind: string; ip: string; n: string; lastAt: Date }[] = await AppDataSource.query(
      `SELECT kind, ip, SUM(count) AS n, MAX(updated_at) AS "lastAt" FROM security_counters
        WHERE window_start > now() - interval '24 hours'
        GROUP BY kind, ip ORDER BY SUM(count) DESC LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({ kind: row.kind, ip: row.ip, count: toInt(row.n), lastAt: row.lastAt }));
  }

  /** (kind, address) pairs over their hourly threshold, for the alert rules. */
  async bursts(thresholds: Record<string, number>): Promise<{ kind: string; ip: string; count: number }[]> {
    const rows: { kind: string; ip: string; n: string }[] = await AppDataSource.query(
      `SELECT kind, ip, SUM(count) AS n FROM security_counters
        WHERE window_start > now() - interval '1 hour' GROUP BY kind, ip`,
    );
    return rows
      .map((row) => ({ kind: row.kind, ip: row.ip, count: toInt(row.n) }))
      .filter((row) => row.count >= (thresholds[row.kind] ?? Number.POSITIVE_INFINITY));
  }

  /** Drops windows older than the retention. Returns how many went. */
  async purgeOlderThan(days: number): Promise<number> {
    const result: unknown = await AppDataSource.query(
      `DELETE FROM security_counters WHERE window_start < now() - make_interval(days => $1)`,
      [days],
    );
    // pg returns [rows, count] for DELETE.
    return Array.isArray(result) && typeof result[1] === "number" ? result[1] : 0;
  }
}
