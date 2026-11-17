import { AppDataSource } from "../infrastructure/database/dataSource";
import { logger } from "../infrastructure/logger/logger";
import { captureError } from "../infrastructure/monitoring/sentry";

/**
 * Runs `work` under a Postgres session advisory lock, on a connection of its
 * own, so overlapping runs and several instances never do the same job at once
 * (Backend Guide §25). Returns null when another run holds the lock, or when
 * the job fails — a failing job is logged and never stops the others.
 */
export async function withJobLock<T>(name: string, lockId: number, work: () => Promise<T>): Promise<T | null> {
  const runner = AppDataSource.createQueryRunner();
  try {
    await runner.connect();
    const rows: { locked: boolean }[] = await runner.query(`SELECT pg_try_advisory_lock($1) AS locked`, [lockId]);
    if (!rows[0]?.locked) {
      logger.debug({ job: name }, "job skipped: already running elsewhere");
      return null;
    }
    try {
      const result = await work();
      logger.debug({ job: name, result }, "job finished");
      return result;
    } finally {
      await runner.query(`SELECT pg_advisory_unlock($1)`, [lockId]);
    }
  } catch (err) {
    logger.error({ err, job: name }, "job failed");
    captureError(err, { job: name });
    return null;
  } finally {
    await runner.release().catch(() => undefined);
  }
}
