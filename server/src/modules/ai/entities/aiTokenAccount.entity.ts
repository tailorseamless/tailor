import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/**
 * A business's AI token balance. Created the first time it is spent or topped up (until then it is the starting
 * amount in AI settings). Changed only by single atomic statements (AiTokenRepository), so it can't go below
 * zero or be spent twice.
 */
@Entity("ai_token_accounts")
@Check(`"balance" >= 0`)
export class AiTokenAccount {
  @PrimaryColumn({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ type: "integer", default: 0 })
  balance: number;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
