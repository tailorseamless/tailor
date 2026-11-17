import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/** A push copy of an in-app notification, waiting for the delivery job (Backend Guide §26.1). */
@Entity("push_deliveries")
@Index("IDX_push_deliveries_due", ["nextAttemptAt"], { where: `"status" = 'pending'` })
@Index("UQ_push_deliveries_notification", ["notificationId"], { unique: true })
@Check(`"status" IN ('pending','sent','failed','cancelled')`)
export class PushDelivery {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "notification_id", type: "uuid" })
  notificationId: string;

  @ForeignKey("Notification", "notification_id", "CASCADE")
  notification?: unknown;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ForeignKey("User", "user_id", "CASCADE")
  user?: unknown;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: "pending" | "sent" | "failed" | "cancelled";

  @Column({ type: "integer", default: 0 })
  attempts: number;

  @Column({ name: "next_attempt_at", type: "timestamptz", default: () => "now()" })
  nextAttemptAt: Date;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError: string | null;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
