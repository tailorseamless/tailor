import { EXPORT } from "../../../config/constants";
import { hasPermission } from "../../../config/permissions";
import { toCsv, toXlsx, type ExportSheet, type ExportTable } from "../../../infrastructure/documents/exportWriter";
import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { churnRisk } from "../domain/riskRules";
import type {
  AdminNoteDTO,
  AdminReportKind,
  AdoptionDTO,
  ChurnRiskDTO,
  CohortDTO,
  DailyStatDTO,
} from "../dto/insights.dto";
import { RiskRepository, type ChurnRow } from "../repositories/risk.repository";
import { AdminRepository } from "../repositories/admin.repository";
import { AdminNoteRepository } from "../repositories/adminNote.repository";
import { AlertRepository } from "../repositories/alert.repository";
import { InsightsRepository } from "../repositories/insights.repository";

const DAY_MS = 86_400_000;
/** On the first run, the rollup reaches back this far; after that it redoes the last few days. */
const BACKFILL_DAYS = 90;
const REDO_DAYS = 2;
/** Businesses younger than this are still setting up; the churn list leaves them out. */
const CHURN_MIN_AGE_DAYS = 14;

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
} as const;

/**
 * Growth and adoption for the platform admin: the daily rollup (a job), trends, feature adoption,
 * sign-up cohorts, admin notes, and the admin reports as CSV or Excel files. Counts and accounts only.
 */
export class InsightsService {
  static Instance = new InsightsService();

  private constructor(
    private readonly insights = InsightsRepository.Instance,
    private readonly notes = AdminNoteRepository.Instance,
    private readonly admin = AdminRepository.Instance,
    private readonly alerts = AlertRepository.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly risk = RiskRepository.Instance,
  ) {}

  /** The `rollupPlatformStats` job: the last few days again (late data), or 90 days on the first run. */
  async rollup(now = Date.now()): Promise<{ from: string; to: string; days: number }> {
    const latest = await this.insights.latestStatDay();
    const from = latest
      ? utcDay(Math.min(Date.parse(latest), now) - REDO_DAYS * DAY_MS)
      : utcDay(now - (BACKFILL_DAYS - 1) * DAY_MS);
    const to = utcDay(now);
    return { from, to, days: await this.insights.rollup(from, to) };
  }

  dailyStats(days: number): Promise<DailyStatDTO[]> {
    return this.insights.dailyStats(days);
  }

  adoption(days: number): Promise<AdoptionDTO> {
    return this.insights.adoption(days);
  }

  cohorts(weeks: number): Promise<CohortDTO[]> {
    return this.insights.cohorts(weeks);
  }

  /**
   * Businesses most at risk of leaving, highest score first. Only those old enough to judge
   * (CHURN_MIN_AGE_DAYS) and scoring at least `minScore`.
   */
  async churnRisk(minScore: number, limit: number): Promise<ChurnRiskDTO[]> {
    const rows = await this.risk.churnInputs({ minAgeDays: CHURN_MIN_AGE_DAYS });
    return rows
      .map((row) => this.toChurn(row))
      .filter((item) => item.score >= minScore)
      .sort((a, b) => b.score - a.score || (b.daysSinceActivity ?? 9999) - (a.daysSinceActivity ?? 9999))
      .slice(0, limit);
  }

  /** One business's churn risk, whatever its age (for Business 360). */
  async churnRiskFor(businessId: string): Promise<ChurnRiskDTO | null> {
    const [row] = await this.risk.churnInputs({ minAgeDays: 0, businessId });
    return row ? this.toChurn(row) : null;
  }

  private toChurn(row: ChurnRow): ChurnRiskDTO {
    const risk = churnRisk(row);
    return {
      businessId: row.businessId,
      name: row.name,
      ownerEmail: row.ownerEmail,
      createdAt: row.createdAt,
      daysSinceActivity: row.daysSinceActivity,
      ...risk,
    };
  }

  async listNotes(businessId: string): Promise<AdminNoteDTO[]> {
    if (!(await this.admin.findBusiness(businessId))) throw AppError.notFound("Business not found");
    return this.notes.list(businessId);
  }

  /** Adds a note to a business; the audit log records that one was added (not what it says). */
  async addNote(actor: Actor, businessId: string, body: string): Promise<AdminNoteDTO[]> {
    await runInTransaction(async (tx) => {
      if (!(await this.admin.findBusiness(businessId, tx))) throw AppError.notFound("Business not found");
      const id = await this.notes.create(businessId, actor.id, body, tx);
      await this.activity.audit(
        {
          businessId,
          actorId: actor.id,
          action: "admin.note_added",
          entityType: "admin_note",
          entityId: id,
        },
        tx,
      );
    });
    return this.notes.list(businessId);
  }

  /**
   * One admin report as a file. The admin-actions report is the raw audit trail, so it needs
   * `admin.audit`; the rest need what the screens need. Every export is itself audited.
   */
  async export(
    actor: Actor,
    kind: AdminReportKind,
    format: "csv" | "xlsx",
    days: number,
  ): Promise<{ filename: string; contentType: string; content: Buffer }> {
    if (kind === "admin-actions" && !hasPermission(actor.roles, "admin.audit")) throw AppError.forbidden();
    const sheets = await this.sheets(kind, days);
    const truncated = sheets.some((sheet) => sheet.rows.length >= EXPORT.maxRows);
    const today = utcDay(Date.now());
    const table: ExportTable = {
      title: `Tailor Seamless platform — ${kind.replace(/-/g, " ")}`,
      notes: [
        `Exported ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC by a platform admin.`,
        "Counts and account details only; no business's customers, orders or payments.",
        ...(["admin-actions", "daily-stats", "adoption"].includes(kind) ? [`Period: the last ${days} days.`] : []),
        ...(truncated ? [`Only the first ${EXPORT.maxRows} rows are included.`] : []),
      ],
      sheets,
    };
    await this.activity.audit({
      businessId: null,
      actorId: actor.id,
      action: "admin.exported",
      entityType: "report",
      payload: { kind, format, days, rows: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0) },
    });
    return {
      filename: `tailor-seamless-${kind}-${today}.${format}`,
      contentType: CONTENT_TYPES[format],
      content: format === "csv" ? toCsv(table) : await toXlsx(table),
    };
  }

  private async sheets(kind: AdminReportKind, days: number): Promise<ExportSheet[]> {
    const max = EXPORT.maxRows;
    switch (kind) {
      case "churn-risk": {
        const list = await this.churnRisk(0, max);
        return [
          {
            name: "Churn risk",
            columns: [
              { key: "name", header: "Business", type: "text" },
              { key: "ownerEmail", header: "Owner email", type: "text" },
              { key: "score", header: "Risk score (0-100)", type: "number" },
              { key: "level", header: "Level", type: "text" },
              { key: "daysSinceActivity", header: "Days since last activity", type: "number" },
              { key: "reasons", header: "Why", type: "text" },
              { key: "createdAt", header: "Joined", type: "datetime" },
            ],
            rows: list.map((c) => ({ ...c, reasons: c.reasons.join("; ") })),
          },
        ];
      }
      case "businesses": {
        const { data } = await this.admin.listBusinesses({ page: 1, limit: max });
        return [
          {
            name: "Businesses",
            columns: [
              { key: "name", header: "Business", type: "text" },
              { key: "status", header: "Status", type: "text" },
              { key: "owner", header: "Owner", type: "text" },
              { key: "ownerEmail", header: "Owner email", type: "text" },
              { key: "currency", header: "Currency", type: "text" },
              { key: "members", header: "Team", type: "number" },
              { key: "customers", header: "Customers", type: "number" },
              { key: "orders", header: "Orders", type: "number" },
              { key: "lastOrderAt", header: "Last order", type: "datetime" },
              { key: "createdAt", header: "Joined", type: "datetime" },
              { key: "deletionScheduledFor", header: "Closing on", type: "datetime" },
            ],
            rows: data.map((b) => ({
              name: b.name,
              status: b.status,
              owner: b.owner?.fullName ?? "",
              ownerEmail: b.owner?.email ?? "",
              currency: b.currency,
              members: b.counts.members,
              customers: b.counts.customers,
              orders: b.counts.orders,
              lastOrderAt: b.lastOrderAt,
              createdAt: b.createdAt,
              deletionScheduledFor: b.deletionScheduledFor,
            })),
          },
        ];
      }
      case "people": {
        const { data } = await this.admin.listUsers({ page: 1, limit: max });
        return [
          {
            name: "People",
            columns: [
              { key: "fullName", header: "Name", type: "text" },
              { key: "email", header: "Email", type: "text" },
              { key: "businessName", header: "Business", type: "text" },
              { key: "role", header: "Role", type: "text" },
              { key: "status", header: "Status", type: "text" },
              { key: "platformRole", header: "Platform role", type: "text" },
              { key: "hasSignedIn", header: "Has signed in", type: "text" },
              { key: "lastSeenAt", header: "Last seen", type: "datetime" },
              { key: "createdAt", header: "Joined", type: "datetime" },
            ],
            rows: data.map((u) => ({ ...u, hasSignedIn: u.hasSignedIn ? "yes" : "no", role: u.role ?? "" })),
          },
        ];
      }
      case "admin-actions": {
        const { data } = await this.activity.list({
          limit: max,
          action: "admin.",
          from: new Date(Date.now() - days * DAY_MS),
        });
        return [
          {
            name: "Admin actions",
            columns: [
              { key: "createdAt", header: "When", type: "datetime" },
              { key: "actor", header: "Admin", type: "text" },
              { key: "action", header: "Action", type: "text" },
              { key: "business", header: "Business", type: "text" },
              { key: "entity", header: "Record", type: "text" },
              { key: "reason", header: "Reason or note", type: "text" },
              { key: "ip", header: "IP address", type: "text" },
            ],
            rows: data.map((e) => ({
              createdAt: e.createdAt,
              actor: e.actor ? `${e.actor.fullName} <${e.actor.email}>` : e.actorKind,
              action: e.action,
              business: e.business?.name ?? "Platform",
              entity: `${e.entityType}${e.entityId ? ` ${e.entityId}` : ""}`,
              reason: (e.payload.reason ?? e.payload.note ?? "") as string,
              ip: e.ip ?? "",
            })),
          },
        ];
      }
      case "alerts": {
        const { data } = await this.alerts.list({ page: 1, limit: max });
        return [
          {
            name: "Alerts",
            columns: [
              { key: "createdAt", header: "Raised", type: "datetime" },
              { key: "severity", header: "Severity", type: "text" },
              { key: "status", header: "Status", type: "text" },
              { key: "title", header: "Alert", type: "text" },
              { key: "business", header: "Business", type: "text" },
              { key: "occurrences", header: "Times seen", type: "number" },
              { key: "resolvedAt", header: "Resolved", type: "datetime" },
              { key: "resolvedBy", header: "Resolved by", type: "text" },
              { key: "note", header: "Resolution", type: "text" },
            ],
            rows: data.map((a) => ({
              createdAt: a.createdAt,
              severity: a.severity,
              status: a.status,
              title: a.title,
              business: a.business?.name ?? "Platform",
              occurrences: a.occurrences,
              resolvedAt: a.resolved?.at ?? null,
              resolvedBy: a.resolved ? (a.resolved.by ?? "Cleared by itself") : "",
              note: a.resolved?.note ?? "",
            })),
          },
        ];
      }
      case "daily-stats": {
        const rows = await this.insights.dailyStats(days);
        return [
          {
            name: "Daily figures (UTC)",
            columns: [
              { key: "day", header: "Day", type: "text" },
              { key: "businessesTotal", header: "Businesses", type: "number" },
              { key: "businessesNew", header: "New businesses", type: "number" },
              { key: "businessesActive7d", header: "Active businesses (7 days)", type: "number" },
              { key: "peopleNew", header: "New people", type: "number" },
              { key: "peopleActive7d", header: "Active people (7 days)", type: "number" },
              { key: "ordersNew", header: "Orders", type: "number" },
              { key: "appointmentsNew", header: "Appointments", type: "number" },
              { key: "paymentsNew", header: "Payments", type: "number" },
              { key: "emailsSent", header: "Emails sent", type: "number" },
              { key: "emailsFailed", header: "Emails failed", type: "number" },
            ],
            rows: rows as unknown as Record<string, unknown>[],
          },
        ];
      }
      case "adoption": {
        const adoption = await this.insights.adoption(days);
        return [
          {
            name: "Feature adoption",
            columns: [
              { key: "label", header: "Feature", type: "text" },
              { key: "businesses", header: "Businesses using it", type: "number" },
              { key: "share", header: "Share of active businesses (%)", type: "number" },
            ],
            rows: adoption.features.map((f) => ({
              label: f.label,
              businesses: f.businesses,
              share: adoption.activeBusinesses ? Math.round((f.businesses / adoption.activeBusinesses) * 100) : 0,
            })),
          },
        ];
      }
      case "cohorts": {
        const cohorts = await this.insights.cohorts(26);
        const point = (c: CohortDTO, week: number) => {
          const r = c.retention.find((x) => x.week === week);
          return r && r.eligible ? Math.round((r.retained / r.eligible) * 100) : null;
        };
        return [
          {
            name: "Sign-up cohorts",
            columns: [
              { key: "weekStart", header: "Signed up the week of", type: "text" },
              { key: "size", header: "Businesses", type: "number" },
              { key: "activated", header: "First order within 14 days", type: "number" },
              { key: "w2", header: "Active in week 2 (%)", type: "number" },
              { key: "w4", header: "Active in week 4 (%)", type: "number" },
              { key: "w12", header: "Active in week 12 (%)", type: "number" },
            ],
            rows: cohorts.map((c) => ({
              weekStart: c.weekStart,
              size: c.size,
              activated: c.activated,
              w2: point(c, 2),
              w4: point(c, 4),
              w12: point(c, 12),
            })),
          },
        ];
      }
    }
  }
}
