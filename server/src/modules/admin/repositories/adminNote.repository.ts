import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { Tx } from "../../../shared/repositories/transaction";
import type { AdminNoteDTO } from "../dto/insights.dto";

export class AdminNoteRepository {
  static Instance = new AdminNoteRepository();

  private constructor() {}

  async create(businessId: string, authorId: string, body: string, tx: Tx): Promise<string> {
    const [row]: { id: string }[] = await tx.query(
      `INSERT INTO admin_notes (business_id, author_id, body) VALUES ($1, $2, $3) RETURNING id`,
      [businessId, authorId, body],
    );
    if (!row) throw new Error("admin note insert returned no row");
    return row.id;
  }

  /** Newest first; a business rarely has more than a few. */
  async list(businessId: string, limit = 100): Promise<AdminNoteDTO[]> {
    const rows: { id: string; createdAt: Date; body: string; authorId: string | null; authorName: string | null }[] =
      await AppDataSource.query(
        `SELECT n.id, n.created_at AS "createdAt", n.body, n.author_id AS "authorId", u.full_name AS "authorName"
           FROM admin_notes n LEFT JOIN users u ON u.id = n.author_id
          WHERE n.business_id = $1 ORDER BY n.created_at DESC LIMIT $2`,
        [businessId, limit],
      );
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      body: row.body,
      author: row.authorId ? { id: row.authorId, fullName: row.authorName ?? "" } : null,
    }));
  }
}
