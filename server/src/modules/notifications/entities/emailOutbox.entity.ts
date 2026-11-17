import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";
import type { EmailKind, EmailStatus } from "../dto/email.dto";

/**
 * Emails waiting to go, and what happened to them (Backend Guide §26.1).
 * Rows are queued in the transaction of the change; the delivery job sends
 * them. Not user content: no soft delete.
 */
@Entity("email_outbox")
@Index("IDX_email_outbox_due", ["nextAttemptAt"], { where: `"status" = 'pending'` })
@Index(["businessId", "createdAt"])
@Index("UQ_email_outbox_dedupe", ["dedupeKey"], { unique: true, where: `"dedupe_key" IS NOT NULL` })
@Check(`"status" IN ('pending','sent','failed','cancelled')`)
export class EmailOutbox {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ type: "varchar", length: 50 })
  kind: EmailKind;

  @Column({ name: "to_address", type: "varchar", length: 150 })
  toAddress: string;

  @Column({ name: "to_name", type: "varchar", length: 150, nullable: true })
  toName: string | null;

  @Column({ type: "jsonb", default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: EmailStatus;

  @Column({ type: "integer", default: 0 })
  attempts: number;

  @Column({ name: "next_attempt_at", type: "timestamptz", default: () => "now()" })
  nextAttemptAt: Date;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError: string | null;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @Column({ name: "provider_message_id", type: "varchar", length: 255, nullable: true })
  providerMessageId: string | null;

  @Column({ name: "dedupe_key", type: "varchar", length: 200, nullable: true })
  dedupeKey: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
