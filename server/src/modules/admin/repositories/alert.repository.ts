import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { buildMeta, getOffset, type Paginated } from "../../../shared/pagination/paginate";
import type { Tx } from "../../../shared/repositories/transaction";
import type {
  AdminAlertDTO,
  AlertCandidate,
  AlertSeverity,
  AlertStatus,
  ListAlertsParams,
  OpenAlertCounts,
} from "../dto/alert.dto";

const toInt = (value: unknown) => Number(value ?? 0);

type AlertRow = Omit<AdminAlertDTO, "business" | "acknowledged" | "resolved"> & {
  businessId: string | null;
  businessName: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
};

const SELECT = `
  SELECT a.id, a.created_at AS "createdAt", a.type, a.severity, a.status, a.title, a.detail, a.data,
         a.occurrences, a.last_seen_at AS "lastSeenAt",
         a.business_id AS "businessId", b.name AS "businessName",
         ack.full_name AS "acknowledgedBy", a.acknowledged_at AS "acknowledgedAt",
         res.full_name AS "resolvedBy", a.resolved_at AS "resolvedAt", a.resolution_note AS "resolutionNote"
    FROM admin_alerts a
    LEFT JOIN businesses b ON b.id = a.business_id
    LEFT JOIN users ack ON ack.id = a.acknowledged_by
    LEFT JOIN users res ON res.id = a.resolved_by`;

function toDTO(row: AlertRow): AdminAlertDTO {
  return {
    id: row.id,
    createdAt: row.createdAt,
    type: row.type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    detail: row.detail,
    business: row.businessId ? { id: row.businessId, name: row.businessName ?? "" } : null,
    data: row.data,
    occurrences: row.occurrences,
    lastSeenAt: row.lastSeenAt,
    acknowledged: row.acknowledgedAt ? { by: row.acknowledgedBy, at: row.acknowledgedAt } : null,
    resolved: row.resolvedAt ? { by: row.resolvedBy, at: row.resolvedAt, note: row.resolutionNote } : null,
  };
}

/** Severity first (critical on top), then newest. */
const ORDER = `CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.created_at DESC, a.id`;

export class AlertRepository {
  static Instance = new AlertRepository();

  private constructor() {}

  /**
   * Opens an alert for this condition, or — while one is still open for the same key — counts the
   * new sighting on it. Returns the alert's id and whether it was newly opened.
   */
  async raise(candidate: AlertCandidate): Promise<{ id: string; inserted: boolean }> {
    const rows: { id: string; inserted: boolean }[] = await AppDataSource.query(
      `INSERT INTO admin_alerts (type, severity, title, detail, business_id, data, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (dedupe_key) WHERE status <> 'resolved'
       DO UPDATE SET occurrences = admin_alerts.occurrences + 1, last_seen_at = now(), updated_at = now(),
                     detail = EXCLUDED.detail, data = EXCLUDED.data
       RETURNING id, (xmax = 0) AS inserted`,
      [
        candidate.type,
        candidate.severity,
        candidate.title,
        candidate.detail ?? null,
        candidate.businessId ?? null,
        JSON.stringify(candidate.data ?? {}),
        candidate.dedupeKey,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("admin alert upsert returned no row");
    return { id: row.id, inserted: row.inserted === true };
  }

  /**
   * For rules that describe a state (a job failing, requests waiting): closes the open alerts of
   * that type whose condition is gone. Returns how many cleared.
   */
  async resolveCleared(type: string, stillTrue: string[]): Promise<number> {
    const rows: unknown[] = await AppDataSource.query(
      `UPDATE admin_alerts
          SET status = 'resolved', resolved_at = now(), resolution_note = 'Cleared by itself', updated_at = now()
        WHERE type = $1 AND status <> 'resolved' AND NOT (dedupe_key = ANY($2::text[]))
       RETURNING id`,
      [type, stillTrue],
    );
    // pg returns [rows, count] for UPDATE … RETURNING.
    const list = Array.isArray(rows[0]) ? (rows[0] as unknown[]) : rows;
    return list.length;
  }

  async list(params: ListAlertsParams): Promise<Paginated<AdminAlertDTO>> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (params.status === "active") where.push(`a.status <> 'resolved'`);
    else if (params.status) {
      args.push(params.status);
      where.push(`a.status = $${args.length}`);
    }
    if (params.severity) {
      args.push(params.severity);
      where.push(`a.severity = $${args.length}`);
    }
    const filter = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const [count] = await AppDataSource.query(`SELECT COUNT(*) AS n FROM admin_alerts a${filter}`, args);
    args.push(params.limit, getOffset(params.page, params.limit));
    const rows: AlertRow[] = await AppDataSource.query(
      `${SELECT}${filter} ORDER BY ${ORDER} LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args,
    );
    return { data: rows.map(toDTO), meta: buildMeta(params.page, params.limit, toInt(count.n), rows.length) };
  }

  async find(id: string, tx?: Tx): Promise<AdminAlertDTO | null> {
    const rows: AlertRow[] = await (tx ?? AppDataSource.manager).query(`${SELECT} WHERE a.id = $1`, [id]);
    return rows[0] ? toDTO(rows[0]) : null;
  }

  /** The raw row's business id and status, locked for a change. */
  async lockForChange(id: string, tx: Tx): Promise<{ status: AlertStatus; businessId: string | null } | null> {
    const rows: { status: AlertStatus; businessId: string | null }[] = await tx.query(
      `SELECT status, business_id AS "businessId" FROM admin_alerts WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async acknowledge(id: string, userId: string, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE admin_alerts SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = now(), updated_at = now()
        WHERE id = $1`,
      [id, userId],
    );
  }

  async resolve(id: string, userId: string, note: string | null, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE admin_alerts SET status = 'resolved', resolved_by = $2, resolved_at = now(), resolution_note = $3,
              updated_at = now()
        WHERE id = $1`,
      [id, userId, note],
    );
  }

  /** Alerts not yet resolved, by severity. */
  async openCounts(): Promise<OpenAlertCounts> {
    const rows: { severity: AlertSeverity; n: string }[] = await AppDataSource.query(
      `SELECT severity, COUNT(*) AS n FROM admin_alerts WHERE status <> 'resolved' GROUP BY severity`,
    );
    const counts: OpenAlertCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of rows) counts[row.severity] = toInt(row.n);
    return counts;
  }
}
