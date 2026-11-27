import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/** The platform's AI settings: a single row (id 1), created by the migration. */
@Entity("ai_settings")
@Check(`"id" = 1`)
@Check(`"starting_tokens" >= 0`)
export class AiSettings {
  @PrimaryColumn({ type: "smallint", default: 1 })
  id: number;

  /** The tokens a business has until it first spends or is given some. */
  @Column({ name: "starting_tokens", type: "integer", default: 100000 })
  startingTokens: number;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy: string | null;

  @ForeignKey("User", "updated_by", "SET NULL")
  updater?: unknown;
}
