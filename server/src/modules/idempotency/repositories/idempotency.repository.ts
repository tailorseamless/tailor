import { BaseRepository, returnedRows } from "../../../shared/repositories/baseRepository";
import { IdempotencyKey } from "../entities/idempotencyKey.entity";

export interface StoredKey {
  id: string;
  requestHash: string;
  /** NULL while the first request is still running. */
  statusCode: number | null;
  response: unknown;
}

export class IdempotencyRepository extends BaseRepository<IdempotencyKey> {
  static Instance = new IdempotencyRepository();

  private constructor() {
    super(IdempotencyKey);
  }

  /**
   * Claims the key in ONE statement, so two identical requests arriving
   * together cannot both run. Returns the new row's id, or null when the key
   * is already taken. An expired key is cleared first.
   */
  async reserve(userId: string, key: string, requestHash: string, expiresAt: Date): Promise<string | null> {
    await this.repo().query(`DELETE FROM idempotency_keys WHERE user_id = $1 AND key = $2 AND expires_at < now()`, [
      userId,
      key,
    ]);
    const result: unknown = await this.repo().query(
      `INSERT INTO idempotency_keys (user_id, key, request_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, key) DO NOTHING
       RETURNING id`,
      [userId, key, requestHash, expiresAt],
    );
    return returnedRows<{ id: string }>(result)[0]?.id ?? null;
  }

  /** Index: UQ_idempotency_keys_user_key. */
  async findKey(userId: string, key: string): Promise<StoredKey | null> {
    const row = await this.repo().findOne({ where: { userId, key } });
    return row
      ? { id: row.id, requestHash: row.requestHash, statusCode: row.statusCode, response: row.response }
      : null;
  }

  async complete(id: string, statusCode: number, response: unknown): Promise<void> {
    await this.repo().query(`UPDATE idempotency_keys SET status_code = $2, response = $3::jsonb WHERE id = $1`, [
      id,
      statusCode,
      JSON.stringify(response ?? null),
    ]);
  }

  /** Removes keys past their replay window. Index: idempotency_keys(expires_at). */
  async purgeExpired(): Promise<number> {
    const result = await this.repo().createQueryBuilder().delete().where("expires_at < now()").execute();
    return result.affected ?? 0;
  }

  /** Frees a reservation whose request failed, so the client can retry with the same key. */
  async release(id: string): Promise<void> {
    await this.repo().query(`DELETE FROM idempotency_keys WHERE id = $1 AND status_code IS NULL`, [id]);
  }
}
