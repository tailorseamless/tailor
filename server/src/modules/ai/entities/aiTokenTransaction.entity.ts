import { Check, Column, Entity, Index } from "typeorm";
import { AppendOnlyEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { AiUsageFeature } from "../domain/aiFeatures";

export type AiTokenType = "starting" | "grant" | "adjustment" | "usage";

/** The ledger: every change to a business's balance, never edited. */
@Entity("ai_token_transactions")
@Check(`"type" IN ('starting','grant','adjustment','usage')`)
@Index("IDX_ai_token_transactions_business_created", ["businessId", "createdAt"])
export class AiTokenTransaction extends AppendOnlyEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ type: "varchar", length: 20 })
  type: AiTokenType;

  /** Signed: what was added (+) or taken (−). */
  @Column({ type: "integer" })
  amount: number;

  @Column({ name: "balance_after", type: "integer" })
  balanceAfter: number;

  @Column({ type: "varchar", length: 40, nullable: true })
  feature: AiUsageFeature | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  note: string | null;

  /** Who used them, or which admin gave them. */
  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId: string | null;

  @ForeignKey("User", "actor_id", "SET NULL")
  actor?: unknown;
}
