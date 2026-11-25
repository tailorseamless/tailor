import type { Tx } from "../../../shared/repositories/transaction";
import type { AuditInput, ListAuditParams } from "../dto/activity.dto";
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
}
