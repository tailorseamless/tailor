import { env } from "../../../config/env";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { currentRequestContext } from "../../../shared/context/requestContext";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import { actorKindFor, decodeAuditCursor, encodeAuditCursor } from "../domain/auditRules";
import type { AuditEntryDTO, AuditInput, ListAuditParams } from "../dto/activity.dto";
import { AuditLog } from "../entities/auditLog.entity";

export interface AuditPage {
  data: AuditEntryDTO[];
  nextCursor: string | null;
}

type AuditRow = Omit<AuditEntryDTO, "actor" | "business"> & {
  cursorAt: string;
  actorFullName: string | null;
  actorEmail: string | null;
  businessName: string | null;
  businessId: string | null;
  actorId: string | null;
};

export class AuditRepository extends BaseRepository<AuditLog> {
  static Instance = new AuditRepository();

  private constructor() {
    super(AuditLog);
  }

  /** Writes one entry, stamped with the request it came from (when there is one). */
  async append(entry: AuditInput, tx?: Tx): Promise<void> {
    const context = currentRequestContext();
    await this.create(
      {
        businessId: entry.businessId,
        actorId: entry.actorId,
        actorKind: actorKindFor(entry, context, env.apiPrefix),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        payload: entry.payload ?? {},
        outcome: entry.outcome ?? "success",
        requestId: context?.requestId ?? null,
        ip: context?.ip ?? null,
        userAgent: context?.userAgent ?? null,
      },
      tx,
    );
  }

  /**
   * The platform audit view, newest first, across every business. Keyset-paged on (created_at, id)
   * so a page costs the same however deep it is; no COUNT. A cursor that isn't ours starts over.
   */
  async list(params: ListAuditParams): Promise<AuditPage> {
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (clause: (n: number) => string, value: unknown) => {
      args.push(value);
      where.push(clause(args.length));
    };

    const position = params.cursor ? decodeAuditCursor(params.cursor) : null;
    if (position) {
      args.push(position.createdAt, position.id);
      where.push(`(a.created_at, a.id) < ($${args.length - 1}::timestamptz, $${args.length}::uuid)`);
    }
    if (params.businessId) add((n) => `a.business_id = $${n}`, params.businessId);
    if (params.actorId) add((n) => `a.actor_id = $${n}`, params.actorId);
    if (params.actorKind) add((n) => `a.actor_kind = $${n}`, params.actorKind);
    if (params.action?.endsWith(".")) add((n) => `left(a.action, length($${n})) = $${n}`, params.action);
    else if (params.action) add((n) => `a.action = $${n}`, params.action);
    if (params.actions) add((n) => `a.action = ANY($${n}::text[])`, params.actions);
    if (params.entityType) add((n) => `a.entity_type = $${n}`, params.entityType);
    if (params.entityId) add((n) => `a.entity_id = $${n}`, params.entityId);
    if (params.from) add((n) => `a.created_at >= $${n}`, params.from);
    if (params.to) add((n) => `a.created_at < $${n}`, params.to);

    args.push(params.limit + 1); // one extra row says whether there is a next page
    const rows: AuditRow[] = await AppDataSource.query(
      `SELECT a.id, a.created_at AS "createdAt", a.created_at::text AS "cursorAt", a.action, a.outcome,
              a.actor_kind AS "actorKind", a.actor_id AS "actorId", u.full_name AS "actorFullName", u.email AS "actorEmail",
              a.business_id AS "businessId", b.name AS "businessName",
              a.entity_type AS "entityType", a.entity_id AS "entityId", a.payload,
              a.request_id AS "requestId", a.ip, a.user_agent AS "userAgent"
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_id
         LEFT JOIN businesses b ON b.id = a.business_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $${args.length}`,
      args,
    );

    const page = rows.slice(0, params.limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        action: row.action,
        outcome: row.outcome,
        actorKind: row.actorKind,
        actor: row.actorId ? { id: row.actorId, fullName: row.actorFullName ?? "", email: row.actorEmail ?? "" } : null,
        business: row.businessId ? { id: row.businessId, name: row.businessName ?? "" } : null,
        entityType: row.entityType,
        entityId: row.entityId,
        payload: row.payload,
        requestId: row.requestId,
        ip: row.ip,
        userAgent: row.userAgent,
      })),
      nextCursor: rows.length > params.limit && last ? encodeAuditCursor(last.cursorAt, last.id) : null,
    };
  }
}
