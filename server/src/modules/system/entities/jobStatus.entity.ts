import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import type { JobOutcome } from "../dto/system.dto";

/**
 * How each background job last went: one row per job, overwritten after every run (a run that found
 * the lock taken by another server is not a run). Enough to tell the admin whether the jobs are alive
 * and to raise an alert when one keeps failing, without a row per minute.
 */
@Entity("job_status")
@Check(`"last_outcome" IN ('succeeded','failed')`)
export class JobStatus {
  @PrimaryColumn({ type: "varchar", length: 60 })
  name: string;

  @Column({ name: "last_started_at", type: "timestamptz", nullable: true })
  lastStartedAt: Date | null;

  @Column({ name: "last_finished_at", type: "timestamptz", nullable: true })
  lastFinishedAt: Date | null;

  @Column({ name: "last_outcome", type: "varchar", length: 20, nullable: true })
  lastOutcome: JobOutcome | null;

  @Column({ name: "last_succeeded_at", type: "timestamptz", nullable: true })
  lastSucceededAt: Date | null;

  @Column({ name: "last_failed_at", type: "timestamptz", nullable: true })
  lastFailedAt: Date | null;

  /** The message of the last failure (kept after later successes, so it can still be read). */
  @Column({ name: "last_error", type: "text", nullable: true })
  lastError: string | null;

  /** What the last run reported (counts: sent, failed, removed…). */
  @Column({ name: "last_result", type: "jsonb", nullable: true })
  lastResult: unknown;

  @Column({ name: "last_duration_ms", type: "integer", nullable: true })
  lastDurationMs: number | null;

  /** Failures in a row; back to 0 on the next success. */
  @Column({ name: "consecutive_failures", type: "integer", default: 0 })
  consecutiveFailures: number;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
