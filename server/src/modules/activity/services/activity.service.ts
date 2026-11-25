import type { Tx } from "../../../shared/repositories/transaction";
import { FEED_ACTIONS } from "../domain/auditRules";
import type { ActivityItemDTO, AuditInput, ListAuditParams } from "../dto/activity.dto";
import { AuditRepository, type AuditPage } from "../repositories/audit.repository";

export class ActivityService {
  static Instance = new ActivityService();

  private constructor(private readonly audits = AuditRepository.Instance) {}

  /**
   * Appends to the audit trail. Call it INSIDE the transaction of the change,
   * passing `tx`, so the two can never disagree (Backend Guide §8.4, §27.2).
   * The request id, address and device are added from the request context.
   */
  audit(entry: AuditInput, tx?: Tx): Promise<void> {
    return this.audits.append(entry, tx);
  }

  /** The platform-wide audit view (platform admins with `admin.audit` only). */
  list(params: ListAuditParams): Promise<AuditPage> {
    return this.audits.list(params);
  }

  /** The activity feed: allow-listed actions, stripped of request details and payloads. */
  async feed(
    params: Omit<ListAuditParams, "actions" | "actorId" | "entityType" | "entityId">,
  ): Promise<{ data: ActivityItemDTO[]; nextCursor: string | null }> {
    const page = await this.audits.list({ ...params, actions: FEED_ACTIONS });
    return {
      data: page.data.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        action: entry.action,
        actorKind: entry.actorKind,
        actorName: entry.actor ? entry.actor.fullName || entry.actor.email : null,
        business: entry.business,
        entityType: entry.entityType,
        entityId: entry.entityId,
      })),
      nextCursor: page.nextCursor,
    };
  }
}
