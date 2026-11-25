import { AppDataSource } from "../infrastructure/database/dataSource";
import { logger } from "../infrastructure/logger/logger";
import { captureError } from "../infrastructure/monitoring/sentry";
import type { JobOutcome } from "../modules/system/dto/system.dto";
import { JobStatusRepository } from "../modules/system/repositories/jobStatus.repository";

/** Saves how a run went, for the admin's System health and the job-failure alert. Never fails the job. */
async function recordRun(
  name: string,
  startedAt: Date,
  outcome: JobOutcome,
  result: unknown,
  error: unknown,
): Promise<void> {
  try {
    await JobStatusRepository.Instance.record({
      name,
      startedAt,
      outcome,
      durationMs: Date.now() - startedAt.getTime(),
      result,
      error: error === undefined ? null : error instanceof Error ? error.message : String(error),
    });
  } catch (err) {
    logger.warn({ err, job: name }, "job status not recorded");
  }
}

/**
 * Runs `work` under a Postgres session advisory lock, on a connection of its
 * own, so overlapping runs and several instances never do the same job at once
 * (Backend Guide §25). Returns null when another run holds the lock, or when
 * the job fails — a failing job is logged and never stops the others. Every run
 * that happens (not one skipped for the lock) is recorded in `job_status`.
 */
export async function withJobLock<T>(name: string, lockId: number, work: () => Promise<T>): Promise<T | null> {
  const runner = AppDataSource.createQueryRunner();
  let startedAt: Date | null = null;
  try {
    await runner.connect();
    const rows: { locked: boolean }[] = await runner.query(`SELECT pg_try_advisory_lock($1) AS locked`, [lockId]);
    if (!rows[0]?.locked) {
      logger.debug({ job: name }, "job skipped: already running elsewhere");
      return null;
    }
    try {
      startedAt = new Date();
      const result = await work();
      logger.debug({ job: name, result }, "job finished");
      await recordRun(name, startedAt, "succeeded", result, undefined);
      return result;
    } finally {
      await runner.query(`SELECT pg_advisory_unlock($1)`, [lockId]);
    }
  } catch (err) {
    logger.error({ err, job: name }, "job failed");
    captureError(err, { job: name });
    // A failure before the lock was taken (no connection) is not a run of the job; the alert rules
    // see the database itself as down instead.
    if (startedAt) await recordRun(name, startedAt, "failed", null, err);
    return null;
  } finally {
    await runner.release().catch(() => undefined);
  }
}
