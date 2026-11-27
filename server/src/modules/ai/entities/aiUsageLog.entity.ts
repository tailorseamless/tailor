import { Check, Column, Entity, Index } from "typeorm";
import type { AiErrorKind, AiProviderId } from "../../../infrastructure/ai/aiProvider";
import { AppendOnlyEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { AiUsageFeature } from "../domain/aiFeatures";

/**
 * One row per AI request that reached a provider: who, which feature, which model, how many tokens, how it
 * went. Counts only. Prompts, photos and replies are NEVER stored here.
 */
@Entity("ai_usage_logs")
@Check(`"status" IN ('ok','error')`)
@Index("IDX_ai_usage_logs_business_created", ["businessId", "createdAt"])
@Index("IDX_ai_usage_logs_created", ["createdAt"])
export class AiUsageLog extends AppendOnlyEntity {
  /** NULL for the platform admin's key test, which belongs to no business. */
  @Column({ name: "business_id", type: "uuid", nullable: true })
  businessId: string | null;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId: string | null;

  @ForeignKey("User", "user_id", "SET NULL")
  user?: unknown;

  @Column({ type: "varchar", length: 20 })
  provider: AiProviderId;

  @Column({ type: "varchar", length: 120 })
  model: string;

  @Column({ type: "varchar", length: 40 })
  feature: AiUsageFeature;

  @Column({ name: "input_tokens", type: "integer", default: 0 })
  inputTokens: number;

  @Column({ name: "output_tokens", type: "integer", default: 0 })
  outputTokens: number;

  @Column({ type: "varchar", length: 10 })
  status: "ok" | "error";

  /** An AiErrorKind, or "invalid_output" when the reply came back but could not be used. */
  @Column({ name: "error_kind", type: "varchar", length: 20, nullable: true })
  errorKind: AiErrorKind | "invalid_output" | (string & {}) | null;

  @Column({ name: "duration_ms", type: "integer", default: 0 })
  durationMs: number;
}
