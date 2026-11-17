import { Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";

/** An in-app notification for one person. */
@Entity("notifications")
@Index(["userId", "createdAt"]) // a person's feed, newest first
@Index("IDX_notifications_unread", ["userId"], { where: `"read_at" IS NULL AND "deleted_at" IS NULL` }) // bell count
@Index("UQ_notifications_dedupe", ["dedupeKey"], { unique: true, where: `"dedupe_key" IS NOT NULL` })
export class Notification extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ForeignKey("User", "user_id", "CASCADE")
  user?: unknown;

  @Column({ type: "varchar", length: 50 })
  type: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", nullable: true })
  body: string | null;

  @Column({ name: "link_path", type: "varchar", length: 300, nullable: true })
  linkPath: string | null;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt: Date | null;

  @Column({ name: "dedupe_key", type: "varchar", length: 200, nullable: true })
  dedupeKey: string | null;
}
