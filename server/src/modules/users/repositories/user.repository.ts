import { In } from "typeorm";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { AuthRow, UserRecord } from "../dto/user.dto";
import { User } from "../entities/user.entity";

function toRecord(row: User): UserRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    firebaseUid: row.firebaseUid ?? null,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone ?? null,
    platformRole: row.platformRole,
    status: row.status,
    timeZone: row.timeZone,
    deletionScheduledFor: row.deletionScheduledFor ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class UserRepository extends BaseRepository<User> {
  static Instance = new UserRepository();

  private constructor() {
    super(User);
  }

  async findUser(id: string, tx?: Tx): Promise<UserRecord | null> {
    const row = await this.findById(id, tx);
    return row ? toRecord(row) : null;
  }

  /** Several people at once (no N+1). */
  async findUsers(ids: string[], tx?: Tx): Promise<Map<string, UserRecord>> {
    if (ids.length === 0) return new Map();
    const rows = await this.repo(tx).find({ where: { id: In(ids) } });
    return new Map(rows.map((row) => [row.id, toRecord(row)]));
  }

  /** Index: UQ_users_firebase_uid. */
  async findByFirebaseUid(firebaseUid: string, tx?: Tx): Promise<UserRecord | null> {
    const row = await this.repo(tx).findOne({ where: { firebaseUid } });
    return row ? toRecord(row) : null;
  }

  /** `email` must already be lower-cased. Index: UQ_users_email_live. */
  async findByEmail(email: string, tx?: Tx): Promise<UserRecord | null> {
    const row = await this.repo(tx).findOne({ where: { email } });
    return row ? toRecord(row) : null;
  }

  /**
   * The login, its membership and its business in one indexed query — what
   * authMiddleware needs on every (uncached) request.
   */
  async findAuthRow(firebaseUid: string): Promise<AuthRow | null> {
    const rows: AuthRow[] = await this.repo().query(
      `SELECT u.id,
              u.firebase_uid   AS "firebaseUid",
              u.email,
              u.business_id    AS "businessId",
              u.platform_role  AS "platformRole",
              u.status,
              u.time_zone      AS "timeZone",
              m.role           AS "memberRole",
              m.status         AS "memberStatus",
              b.status         AS "businessStatus"
         FROM users u
         JOIN businesses b ON b.id = u.business_id AND b.deleted_at IS NULL
         LEFT JOIN business_members m
                ON m.user_id = u.id AND m.business_id = u.business_id AND m.deleted_at IS NULL
        WHERE u.firebase_uid = $1 AND u.deleted_at IS NULL
        LIMIT 1`,
      [firebaseUid],
    );
    return rows[0] ?? null;
  }

  async createUser(
    data: Pick<UserRecord, "businessId" | "email" | "fullName"> &
      Partial<Pick<UserRecord, "firebaseUid" | "phone" | "timeZone">>,
    tx?: Tx,
  ): Promise<UserRecord> {
    const created = await this.create(data, tx);
    return toRecord((await this.findById(created.id, tx)) ?? created);
  }

  async setDeletionSchedule(id: string, at: Date | null, tx?: Tx): Promise<void> {
    await this.repo(tx).update(id, { deletionScheduledFor: at, updatedAt: new Date() });
  }

  async updateUser(
    id: string,
    data: Partial<Pick<UserRecord, "fullName" | "phone" | "timeZone">>,
    tx?: Tx,
  ): Promise<UserRecord | null> {
    const row = await this.update(id, data, tx);
    return row ? toRecord(row) : null;
  }

  /**
   * Links a Firebase login to the one UNLINKED user with this email, atomically:
   * two first sign-ins at once cannot both claim the row.
   */
  async linkByEmail(email: string, firebaseUid: string, tx?: Tx): Promise<UserRecord | null> {
    const result: unknown = await this.repo(tx).query(
      `UPDATE users
          SET firebase_uid = $1, updated_at = now()
        WHERE email = $2 AND firebase_uid IS NULL AND deleted_at IS NULL
    RETURNING id`,
      [firebaseUid, email],
    );
    // pg returns [rows, affectedCount] for UPDATE … RETURNING.
    const rows = (Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result) as { id: string }[];
    return rows[0] ? this.findUser(rows[0].id, tx) : null;
  }
}
