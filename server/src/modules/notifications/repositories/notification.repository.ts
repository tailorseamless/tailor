import { IsNull } from "typeorm";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { NotificationRecord, NotificationType } from "../dto/notification.dto";
import { Notification } from "../entities/notification.entity";

function toRecord(row: Notification): NotificationRecord {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body ?? null,
    linkPath: row.linkPath ?? null,
    readAt: row.readAt ?? null,
    createdAt: row.createdAt,
  };
}

export interface NotificationRow {
  businessId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  linkPath: string | null;
  dedupeKey: string | null;
}

export class NotificationRepository extends BaseRepository<Notification> {
  static Instance = new NotificationRepository();

  private constructor() {
    super(Notification);
  }

  /** A row whose dedupe key already exists is skipped, not an error. */
  /** Returns the rows actually added: a repeated dedupe key adds nothing. */
  async insertMany(rows: NotificationRow[], tx?: Tx): Promise<{ id: string; userId: string }[]> {
    if (rows.length === 0) return [];
    const result = await this.repo(tx)
      .createQueryBuilder()
      .insert()
      .values(rows)
      .orIgnore()
      // Property names, not column names; without updateEntity(false) TypeORM returns only its defaults.
      .updateEntity(false)
      .returning(["id", "userId"])
      .execute();
    const raw = (Array.isArray(result.raw) ? result.raw : []) as { id: string; user_id: string }[];
    return raw.map((row) => ({ id: row.id, userId: row.user_id }));
  }

  /** Index: notifications(user_id, created_at). */
  async listForUser(params: {
    userId: string;
    businessId: string;
    page: number;
    limit: number;
    unreadOnly?: boolean;
  }): Promise<Paginated<NotificationRecord>> {
    const qb = this.repo().createQueryBuilder("n").where("n.userId = :userId AND n.businessId = :businessId", params);
    if (params.unreadOnly) qb.andWhere("n.readAt IS NULL");
    qb.orderBy("n.createdAt", "DESC").addOrderBy("n.id", "DESC");

    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  /** Cheap: served by the partial index IDX_notifications_unread. */
  countUnread(userId: string, businessId: string): Promise<number> {
    return this.repo().count({ where: { userId, businessId, readAt: IsNull() } });
  }

  async findForUser(id: string, userId: string): Promise<NotificationRecord | null> {
    const row = await this.repo().findOne({ where: { id, userId } });
    return row ? toRecord(row) : null;
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo().update({ id, userId, readAt: IsNull() }, { readAt: new Date() });
  }

  async markAllRead(userId: string, businessId: string): Promise<number> {
    const result = await this.repo().update({ userId, businessId, readAt: IsNull() }, { readAt: new Date() });
    return result.affected ?? 0;
  }
}
