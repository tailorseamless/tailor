import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/** One person's choice for one notification type. No row = the type's defaults. */
@Entity("notification_preferences")
@Index("UQ_notification_preferences_user_type", ["userId", "type"], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ForeignKey("User", "user_id", "CASCADE")
  user?: unknown;

  @Column({ type: "varchar", length: 50 })
  type: string;

  @Column({ name: "in_app", type: "boolean", default: true })
  inApp: boolean;

  @Column({ type: "boolean", default: false })
  email: boolean;

  @Column({ type: "boolean", default: true })
  push: boolean;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
