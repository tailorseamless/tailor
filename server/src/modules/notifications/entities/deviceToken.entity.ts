import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";

/**
 * A browser registered for web push. A token belongs to one browser and moves
 * to whoever registered it last (a shared shop computer).
 */
@Entity("device_tokens")
@Index("UQ_device_tokens_token", ["token"], { unique: true })
@Index(["userId", "lastSeenAt"])
@Index(["lastSeenAt"]) // pruning stale devices
export class DeviceToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ForeignKey("User", "user_id", "CASCADE")
  user?: unknown;

  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  /** The FCM registration token. A credential for this browser: never logged or returned. */
  @Column({ type: "varchar", length: 512, select: false })
  token: string;

  @Column({ name: "user_agent", type: "varchar", length: 300, nullable: true })
  userAgent: string | null;

  @Column({ name: "last_seen_at", type: "timestamptz", default: () => "now()" })
  lastSeenAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
