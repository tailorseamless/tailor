import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * One row per day of platform-wide figures, written by the `rollupPlatformStats` job so trend charts
 * read a few hundred small rows instead of scanning the activity tables. Days are UTC. Counts only.
 * The job recomputes recent days, so a row can change until the day is a couple of days old.
 */
@Entity("platform_daily_stats")
export class PlatformDailyStat {
  /** YYYY-MM-DD (UTC). */
  @PrimaryColumn({ type: "date" })
  day: string;

  /** Businesses that existed (and were not deleted) at the end of the day. */
  @Column({ name: "businesses_total", type: "integer", default: 0 })
  businessesTotal: number;

  @Column({ name: "businesses_new", type: "integer", default: 0 })
  businessesNew: number;

  /** Businesses where a person did anything in the 7 days ending this day. */
  @Column({ name: "businesses_active_7d", type: "integer", default: 0 })
  businessesActive7d: number;

  @Column({ name: "people_new", type: "integer", default: 0 })
  peopleNew: number;

  /** People who did anything in the 7 days ending this day. */
  @Column({ name: "people_active_7d", type: "integer", default: 0 })
  peopleActive7d: number;

  @Column({ name: "orders_new", type: "integer", default: 0 })
  ordersNew: number;

  @Column({ name: "appointments_new", type: "integer", default: 0 })
  appointmentsNew: number;

  @Column({ name: "payments_new", type: "integer", default: 0 })
  paymentsNew: number;

  @Column({ name: "emails_sent", type: "integer", default: 0 })
  emailsSent: number;

  @Column({ name: "emails_failed", type: "integer", default: 0 })
  emailsFailed: number;

  @UpdateDateColumn({ name: "computed_at", type: "timestamptz" })
  computedAt: Date;
}
