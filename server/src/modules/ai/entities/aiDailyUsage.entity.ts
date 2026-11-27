import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/**
 * How many AI requests a business has used today (its own time zone's day), against the platform's daily
 * allowance. Changed only by single atomic statements (AiAllowanceRepository), so two requests at once can
 * never take a business past its allowance. A failed request gives its use back.
 */
@Entity("ai_daily_usage")
@Check(`"used" >= 0`)
export class AiDailyUsage {
  @PrimaryColumn({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @PrimaryColumn({ type: "date" })
  day: string;

  @Column({ type: "integer", default: 0 })
  used: number;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
