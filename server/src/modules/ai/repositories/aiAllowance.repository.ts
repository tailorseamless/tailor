import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { returnedRows } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import { AiSettings } from "../entities/aiSettings.entity";
import { DEFAULT_DAILY_LIMIT } from "../domain/aiFeatures";

/** Today, in the business's own time zone, as a SQL expression over `businesses b`. */
const TODAY = `(now() AT TIME ZONE b.time_zone)::date`;

/**
 * The daily allowance. Every change to `used` is ONE statement whose WHERE clause holds the limit, so
 * concurrent requests can't overspend it; no read-then-write anywhere.
 */
export class AiAllowanceRepository {
  static Instance = new AiAllowanceRepository();

  private constructor() {}

  /** Takes one use if the business is under `limit` today. The day it was counted on, or null when none is left. */
  async reserve(businessId: string, limit: number): Promise<string | null> {
    await AppDataSource.query(
      `INSERT INTO ai_daily_usage (business_id, day, used, updated_at)
       SELECT b.id, ${TODAY}, 0, now() FROM businesses b WHERE b.id = $1
       ON CONFLICT (business_id, day) DO NOTHING`,
      [businessId],
    );
    const rows = returnedRows<{ day: string }>(
      await AppDataSource.query(
        `UPDATE ai_daily_usage u SET used = u.used + 1, updated_at = now()
           FROM businesses b
          WHERE b.id = $1 AND u.business_id = b.id AND u.day = ${TODAY} AND u.used < $2
        RETURNING to_char(u.day, 'YYYY-MM-DD') AS day`,
        [businessId, limit],
      ),
    );
    return rows[0]?.day ?? null;
  }

  /** Gives a use back (the request produced nothing usable). */
  async release(businessId: string, day: string): Promise<void> {
    await AppDataSource.query(
      `UPDATE ai_daily_usage SET used = GREATEST(used - 1, 0), updated_at = now() WHERE business_id = $1 AND day = $2::date`,
      [businessId, day],
    );
  }

  async usedToday(businessId: string): Promise<number> {
    const [row] = await AppDataSource.query(
      `SELECT u.used FROM ai_daily_usage u JOIN businesses b ON b.id = u.business_id
        WHERE u.business_id = $1 AND u.day = ${TODAY}`,
      [businessId],
    );
    return Number(row?.used ?? 0);
  }
}

/** The single settings row. The migration creates it; this recreates it if it is ever missing. */
export class AiSettingsRepository {
  static Instance = new AiSettingsRepository();

  private constructor() {}

  async get(): Promise<AiSettings> {
    const repo = AppDataSource.getRepository(AiSettings);
    const row = await repo.findOne({ where: { id: 1 } });
    if (row) return row;
    await AppDataSource.query(`INSERT INTO ai_settings (id, daily_limit) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`, [
      DEFAULT_DAILY_LIMIT,
    ]);
    return repo.findOneOrFail({ where: { id: 1 } });
  }

  /** The limit before the change (for the audit entry). Run inside the caller's transaction. */
  async update(dailyLimit: number, updatedBy: string, tx: Tx): Promise<number> {
    const before = await this.get();
    await tx.getRepository(AiSettings).update({ id: 1 }, { dailyLimit, updatedBy });
    return before.dailyLimit;
  }
}
