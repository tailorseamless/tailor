import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";
import type { AlertSeverity, AlertStatus } from "../dto/alert.dto";

/**
 * Something on the platform that needs a platform admin's attention ("what requires action?"),
 * raised by the `evaluateAdminAlerts` job's rules. One OPEN alert per condition (`dedupe_key`):
 * while it is open, the same condition only bumps `occurrences` and `last_seen_at`; once resolved,
 * a new occurrence opens a new alert. Not user content: never deleted.
 */
@Entity("admin_alerts")
@Index("UQ_admin_alerts_open_dedupe", ["dedupeKey"], { unique: true, where: `"status" <> 'resolved'` })
@Index("IDX_admin_alerts_status", ["status", "createdAt"])
@Check(`"severity" IN ('critical','high','medium','low')`)
@Check(`"status" IN ('open','acknowledged','resolved')`)
export class AdminAlert {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  /** Which rule raised it, e.g. `job_failing`, `payment_reversals`. */
  @Column({ type: "varchar", length: 60 })
  type: string;

  @Column({ type: "varchar", length: 20 })
  severity: AlertSeverity;

  @Column({ type: "varchar", length: 20, default: "open" })
  status: AlertStatus;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", nullable: true })
  detail: string | null;

  /** The business it is about; NULL for platform-wide conditions (a failing job). */
  @Column({ name: "business_id", type: "uuid", nullable: true })
  businessId: string | null;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  /** Ids and counts behind it — never personal details. */
  @Column({ type: "jsonb", default: () => "'{}'" })
  data: Record<string, unknown>;

  @Column({ name: "dedupe_key", type: "varchar", length: 200 })
  dedupeKey: string;

  /** How many times the rule has seen the condition while this alert was open. */
  @Column({ type: "integer", default: 1 })
  occurrences: number;

  @Column({ name: "last_seen_at", type: "timestamptz", default: () => "now()" })
  lastSeenAt: Date;

  @Column({ name: "acknowledged_by", type: "uuid", nullable: true })
  acknowledgedBy: string | null;

  @ForeignKey("User", "acknowledged_by", "SET NULL")
  acknowledger?: unknown;

  @Column({ name: "acknowledged_at", type: "timestamptz", nullable: true })
  acknowledgedAt: Date | null;

  /** NULL with `resolved_at` set = it cleared by itself (the job recovered). */
  @Column({ name: "resolved_by", type: "uuid", nullable: true })
  resolvedBy: string | null;

  @ForeignKey("User", "resolved_by", "SET NULL")
  resolver?: unknown;

  @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
  resolvedAt: Date | null;

  @Column({ name: "resolution_note", type: "text", nullable: true })
  resolutionNote: string | null;
}
