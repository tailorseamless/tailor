import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * Security-relevant failures, counted per kind and address in 10-minute windows (not one row per
 * event, so a flood can't flood the database too). Kinds: auth_failed, disabled_access, forbidden,
 * rate_limited, portal_token_invalid. Old windows are purged after 30 days.
 */
@Entity("security_counters")
export class SecurityCounter {
  @PrimaryColumn({ name: "window_start", type: "timestamptz" })
  windowStart: Date;

  @PrimaryColumn({ type: "varchar", length: 40 })
  kind: string;

  @PrimaryColumn({ type: "varchar", length: 64 })
  ip: string;

  @Column({ type: "integer", default: 0 })
  count: number;

  /** The signed-in person behind the latest one, when there was one (a forbidden request). */
  @Column({ name: "last_user_id", type: "uuid", nullable: true })
  lastUserId: string | null;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
