import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/**
 * One row per (user, Idempotency-Key). Reserved when the request starts
 * (`status_code` NULL), completed with the response when it succeeds, removed
 * if it fails. Not user content: no soft delete (Backend Guide §27.1).
 */
@Entity("idempotency_keys")
@Index("UQ_idempotency_keys_user_key", ["userId", "key"], { unique: true })
@Index(["expiresAt"]) // purge of expired keys
export class IdempotencyKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ForeignKey("User", "user_id", "CASCADE")
  user?: unknown;

  @Column({ type: "varchar", length: 100 })
  key: string;

  /** SHA-256 of method + path + body: the same key with a different request is a 409. */
  @Column({ name: "request_hash", type: "varchar", length: 64 })
  requestHash: string;

  @Column({ name: "status_code", type: "integer", nullable: true })
  statusCode: number | null;

  @Column({ type: "jsonb", nullable: true })
  response: unknown;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
