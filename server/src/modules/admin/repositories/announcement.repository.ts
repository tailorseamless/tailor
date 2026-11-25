import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { Tx } from "../../../shared/repositories/transaction";
import type {
  AnnouncementAudience,
  AnnouncementDTO,
  AnnouncementStatus,
  NewAnnouncementInput,
} from "../dto/announcement.dto";

export interface AnnouncementWork {
  id: string;
  title: string;
  body: string;
  linkPath: string | null;
  audience: AnnouncementAudience;
  cursorBusinessId: string | null;
}

export class AnnouncementRepository {
  static Instance = new AnnouncementRepository();

  private constructor() {}

  async create(authorId: string, input: NewAnnouncementInput, tx: Tx): Promise<string> {
    const [row]: { id: string }[] = await tx.query(
      `INSERT INTO platform_announcements (author_id, title, body, link_path, audience)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [authorId, input.title, input.body, input.linkPath ?? null, input.audience],
    );
    if (!row) throw new Error("announcement insert returned no row");
    return row.id;
  }

  async list(limit = 50): Promise<AnnouncementDTO[]> {
    const rows: (Omit<AnnouncementDTO, "author"> & { authorId: string | null; authorName: string | null })[] =
      await AppDataSource.query(
        `SELECT a.id, a.created_at AS "createdAt", a.title, a.body, a.link_path AS "linkPath", a.audience, a.status,
                a.businesses_reached AS "businessesReached", a.recipients, a.sent_at AS "sentAt",
                a.author_id AS "authorId", u.full_name AS "authorName"
           FROM platform_announcements a LEFT JOIN users u ON u.id = a.author_id
          ORDER BY a.created_at DESC LIMIT $1`,
        [limit],
      );
    return rows.map(({ authorId, authorName, ...row }) => ({
      ...row,
      author: authorId ? { id: authorId, fullName: authorName ?? "" } : null,
    }));
  }

  async findStatus(id: string, tx: Tx): Promise<AnnouncementStatus | null> {
    const [row]: { status: AnnouncementStatus }[] = await tx.query(
      `SELECT status FROM platform_announcements WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return row?.status ?? null;
  }

  async cancel(id: string, tx: Tx): Promise<void> {
    await tx.query(`UPDATE platform_announcements SET status = 'cancelled', updated_at = now() WHERE id = $1`, [id]);
  }

  /** The oldest announcement still to deliver, locked so two servers never send the same batch. */
  async claimNext(tx: Tx): Promise<AnnouncementWork | null> {
    const [row]: AnnouncementWork[] = await tx.query(
      `SELECT id, title, body, link_path AS "linkPath", audience, cursor_business_id AS "cursorBusinessId"
         FROM platform_announcements WHERE status IN ('queued', 'sending')
        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    return row ?? null;
  }

  /**
   * The next live businesses after the cursor (id order), each with the people it goes to: the
   * owner, or every active member. People whose account or membership is not active are left out.
   */
  async nextBatch(
    after: string | null,
    audience: AnnouncementAudience,
    size: number,
    tx: Tx,
  ): Promise<{ businessId: string; userIds: string[] }[]> {
    const rows: { businessId: string; userIds: string[] | null }[] = await tx.query(
      `SELECT b.id AS "businessId",
              array_agg(u.id) FILTER (WHERE u.id IS NOT NULL) AS "userIds"
         FROM businesses b
         LEFT JOIN business_members m ON m.business_id = b.id AND m.deleted_at IS NULL AND m.status = 'active'
              AND ($2 = 'everyone' OR m.role = 'owner')
         LEFT JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL AND u.status = 'active'
        WHERE b.deleted_at IS NULL AND b.status = 'active' AND ($1::uuid IS NULL OR b.id > $1::uuid)
        GROUP BY b.id ORDER BY b.id LIMIT $3`,
      [after, audience, size],
    );
    return rows.map((row) => ({ businessId: row.businessId, userIds: row.userIds ?? [] }));
  }

  async advance(id: string, cursor: string, businesses: number, recipients: number, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE platform_announcements
          SET status = 'sending', cursor_business_id = $2, businesses_reached = businesses_reached + $3,
              recipients = recipients + $4, updated_at = now()
        WHERE id = $1`,
      [id, cursor, businesses, recipients],
    );
  }

  async finish(id: string, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE platform_announcements SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    );
  }
}
