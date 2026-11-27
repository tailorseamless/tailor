import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { AiProviderId } from "../../../infrastructure/ai/aiProvider";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/**
 * The platform's AI provider keys: one per provider, at most one in use. The key itself is stored only
 * encrypted (shared/utils/secretBox.ts) and is never returned: only its last 4 characters are shown.
 * Removing a key deletes the row, so no ciphertext is left behind.
 */
@Entity("ai_credentials")
@Check(`"provider" IN ('anthropic','openai','gemini','ollama')`)
export class AiCredential {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @Index("UQ_ai_credentials_provider", { unique: true })
  @Column({ type: "varchar", length: 20 })
  provider: AiProviderId;

  /** The model used for every feature that isn't given its own. */
  @Column({ type: "varchar", length: 120 })
  model: string;

  /** `{ feature: modelId }`. A feature is pinned to at most one key. */
  @Column({ name: "feature_models", type: "jsonb", default: () => "'{}'" })
  featureModels: Record<string, string>;

  /** Ollama only: the server to call. Checked against private networks before saving. */
  @Column({ name: "base_url", type: "varchar", length: 300, nullable: true })
  baseUrl: string | null;

  @Column({ name: "key_ciphertext", type: "text" })
  keyCiphertext: string;

  @Column({ name: "key_last4", type: "varchar", length: 4 })
  keyLast4: string;

  @Index("UQ_ai_credentials_active", { unique: true, where: `"is_active"` })
  @Column({ name: "is_active", type: "boolean", default: false })
  isActive: boolean;

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy: string | null;

  @ForeignKey("User", "updated_by", "SET NULL")
  updater?: unknown;
}
