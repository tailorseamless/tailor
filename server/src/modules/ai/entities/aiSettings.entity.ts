import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/** The platform's AI settings: a single row (id 1), created by the migration. */
@Entity("ai_settings")
@Check(`"id" = 1`)
@Check(`"daily_limit" >= 0`)
export class AiSettings {
  @PrimaryColumn({ type: "smallint", default: 1 })
  id: number;

  /** AI requests each business may make per day on the platform's key. 0 switches AI off for businesses. */
  @Column({ name: "daily_limit", type: "integer", default: 20 })
  dailyLimit: number;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy: string | null;

  @ForeignKey("User", "updated_by", "SET NULL")
  updater?: unknown;
}
