import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { JobOutcome, JobStatusDTO } from "../dto/system.dto";

/** Error text kept per job: enough to recognise the failure, short enough to never bloat the row. */
const ERROR_MAX = 1000;

export class JobStatusRepository {
  static Instance = new JobStatusRepository();

  private constructor() {}

  /** Records one finished run: its outcome, timing and result, and keeps the failure streak. */
  async record(run: {
    name: string;
    startedAt: Date;
    outcome: JobOutcome;
    durationMs: number;
    result: unknown;
    error: string | null;
  }): Promise<void> {
    await AppDataSource.query(
      `INSERT INTO job_status AS j
              (name, last_started_at, last_finished_at, last_outcome, last_succeeded_at, last_failed_at,
               last_error, last_result, last_duration_ms, consecutive_failures, updated_at)
       VALUES ($1, $2, now(), $3::varchar,
               CASE WHEN $3::varchar = 'succeeded' THEN now() END,
               CASE WHEN $3::varchar = 'failed' THEN now() END,
               $4, $5::jsonb, $6, CASE WHEN $3::varchar = 'failed' THEN 1 ELSE 0 END, now())
       ON CONFLICT (name) DO UPDATE SET
              last_started_at = EXCLUDED.last_started_at,
              last_finished_at = EXCLUDED.last_finished_at,
              last_outcome = EXCLUDED.last_outcome,
              last_succeeded_at = COALESCE(EXCLUDED.last_succeeded_at, j.last_succeeded_at),
              last_failed_at = COALESCE(EXCLUDED.last_failed_at, j.last_failed_at),
              last_error = COALESCE(EXCLUDED.last_error, j.last_error),
              last_result = EXCLUDED.last_result,
              last_duration_ms = EXCLUDED.last_duration_ms,
              consecutive_failures = CASE WHEN EXCLUDED.last_outcome = 'failed' THEN j.consecutive_failures + 1 ELSE 0 END,
              updated_at = now()`,
      [
        run.name,
        run.startedAt,
        run.outcome,
        run.error?.slice(0, ERROR_MAX) ?? null,
        JSON.stringify(run.result ?? null),
        run.durationMs,
      ],
    );
  }

  async list(): Promise<JobStatusDTO[]> {
    return AppDataSource.query(
      `SELECT name, last_started_at AS "lastStartedAt", last_finished_at AS "lastFinishedAt",
              last_outcome AS "lastOutcome", last_succeeded_at AS "lastSucceededAt", last_failed_at AS "lastFailedAt",
              consecutive_failures AS "consecutiveFailures", last_duration_ms AS "lastDurationMs",
              last_result AS "lastResult", last_error AS "lastError"
         FROM job_status ORDER BY name`,
    );
  }
}
