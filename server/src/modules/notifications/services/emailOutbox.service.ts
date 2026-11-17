import type { Paginated } from "../../../shared/pagination/paginate";
import type { Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { MailerService } from "../../../shared/services/mailer.service";
import type { EmailKind, EmailStatus, OutboxListItem, QueueEmailInput } from "../dto/email.dto";
import { EmailOutboxRepository } from "../repositories/emailOutbox.repository";

/**
 * Queues email. Call it INSIDE the transaction of the change it reports, so a
 * rolled-back change never emails anyone (Backend Guide §26.1). Nothing is
 * sent from a request: the delivery job does that.
 */
export class EmailOutboxService {
  static Instance = new EmailOutboxService();

  private constructor(
    private readonly outbox = EmailOutboxRepository.Instance,
    private readonly mailer = MailerService.Instance,
  ) {}

  queue<K extends EmailKind>(input: QueueEmailInput<K>, tx?: Tx): Promise<boolean> {
    return this.outbox.enqueue(input as QueueEmailInput, tx);
  }

  /** The business's own outbox — what went, what failed and why. */
  async list(
    actor: Actor,
    query: { page: number; limit: number; status?: EmailStatus },
  ): Promise<Paginated<OutboxListItem> & { emailEnabled: boolean }> {
    const page = await this.outbox.listForBusiness({ ...query, businessId: actor.businessId });
    return { ...page, emailEnabled: this.mailer.enabled };
  }
}
