import type { Tx } from "../../../shared/repositories/transaction";
import type { AuditInput } from "../dto/activity.dto";
import { AuditRepository } from "../repositories/audit.repository";

export class ActivityService {
  static Instance = new ActivityService();

  private constructor(private readonly audits = AuditRepository.Instance) {}

  /**
   * Appends to the audit trail. Call it INSIDE the transaction of the change,
   * passing `tx`, so the two can never disagree (Backend Guide §8.4, §27.2).
   */
  audit(entry: AuditInput, tx?: Tx): Promise<void> {
    return this.audits.append(entry, tx);
  }
}
