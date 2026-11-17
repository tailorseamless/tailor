import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { AuditInput } from "../dto/activity.dto";
import { AuditLog } from "../entities/auditLog.entity";

export class AuditRepository extends BaseRepository<AuditLog> {
  static Instance = new AuditRepository();

  private constructor() {
    super(AuditLog);
  }

  async append(entry: AuditInput, tx?: Tx): Promise<void> {
    await this.create(
      {
        businessId: entry.businessId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        payload: entry.payload ?? {},
      },
      tx,
    );
  }
}
