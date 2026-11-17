import type { Repository } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { buildMeta, getOffset, type Paginated } from "../../../shared/pagination/paginate";
import { returnedRows } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { EmailStatus, OutboxListItem, OutboxRow, QueueEmailInput } from "../dto/email.dto";
import { EmailOutbox } from "../entities/emailOutbox.entity";

/** How long a claimed row is held by one sender before another may retry it. */
const LEASE_MINUTES = 10;

export class EmailOutboxRepository {
  static Instance = new EmailOutboxRepository();

  private constructor() {}

  private repo(tx?: Tx): Repository<EmailOutbox> {
    return (tx ?? AppDataSource.manager).getRepository(EmailOutbox);
  }

  /** Queues one email; a repeated dedupe key is skipped, not an error. Returns whether a row was added. */
  async enqueue(input: QueueEmailInput, tx?: Tx): Promise<boolean> {
    const result = await this.repo(tx)
      .createQueryBuilder()
      .insert()
      .values({
        businessId: input.businessId,
        kind: input.kind,
        toAddress: input.to,
        toName: input.toName ?? null,
        // jsonb: TypeORM types a record column as a nested entity; the value is plain JSON.
        payload: input.payload as unknown as QueryDeepPartialEntity<Record<string, unknown>>,
        dedupeKey: input.dedupeKey ?? null,
      })
      .orIgnore()
      .execute();
    // Postgres returns the RETURNING rows in `raw`; a skipped duplicate returns none.
    return Array.isArray(result.raw) && result.raw.length > 0;
  }

  /**
   * Claims due rows by pushing their next attempt into the future in ONE
   * statement (SKIP LOCKED), so two senders never take the same email; a
   * sender that dies leaves the row to be retried when the lease runs out.
   * Index: IDX_email_outbox_due.
   */
  async claimDue(limit: number): Promise<OutboxRow[]> {
    const result: unknown = await this.repo().query(
      `UPDATE email_outbox
          SET next_attempt_at = now() + interval '${LEASE_MINUTES} minutes', updated_at = now()
        WHERE id IN (SELECT id FROM email_outbox
                      WHERE status = 'pending' AND next_attempt_at <= now()
                      ORDER BY next_attempt_at
                      LIMIT $1
                        FOR UPDATE SKIP LOCKED)
    RETURNING id, business_id AS "businessId", kind, to_address AS "toAddress", to_name AS "toName",
              payload, status, attempts, created_at AS "createdAt"`,
      [limit],
    );
    return returnedRows<OutboxRow>(result);
  }

  async markSent(id: string, messageId: string | null): Promise<void> {
    await this.repo().update(id, {
      status: "sent",
      sentAt: new Date(),
      providerMessageId: messageId,
      attempts: () => "attempts + 1",
      lastError: null,
    });
  }

  async markCancelled(id: string, reason: string): Promise<void> {
    await this.repo().update(id, { status: "cancelled", lastError: reason });
  }

  /** A failed attempt: retried later, or given up on. */
  async markAttemptFailed(id: string, error: string, retryAt: Date | null): Promise<void> {
    await this.repo().update(id, {
      attempts: () => "attempts + 1",
      lastError: error.slice(0, 1000),
      ...(retryAt ? { nextAttemptAt: retryAt } : { status: "failed" as EmailStatus }),
    });
  }

  /** Newest first. Index: email_outbox(business_id, created_at). */
  async listForBusiness(params: {
    businessId: string;
    page: number;
    limit: number;
    status?: EmailStatus;
  }): Promise<Paginated<OutboxListItem>> {
    const qb = this.repo()
      .createQueryBuilder("e")
      .select(["e.id", "e.kind", "e.toAddress", "e.status", "e.attempts", "e.lastError", "e.sentAt", "e.createdAt"])
      .where("e.businessId = :businessId", { businessId: params.businessId });
    if (params.status) qb.andWhere("e.status = :status", { status: params.status });
    qb.orderBy("e.createdAt", "DESC").addOrderBy("e.id", "DESC");

    const rows = await qb.clone().offset(getOffset(params.page, params.limit)).limit(params.limit).getMany();
    const total = params.page === 1 ? (rows.length < params.limit ? rows.length : await qb.getCount()) : 0;
    return {
      data: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        toAddress: row.toAddress,
        status: row.status,
        attempts: row.attempts,
        lastError: row.lastError ?? null,
        sentAt: row.sentAt ?? null,
        createdAt: row.createdAt,
      })),
      meta: buildMeta(params.page, params.limit, total, rows.length),
    };
  }
}
