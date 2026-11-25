import { Check, Column, Entity, Index } from "typeorm";
import { DEFAULT_TIME_ZONE } from "../../../config/constants";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { PlatformRole } from "../../../shared/services/access.service";
import type { OnboardingState, UserStatus } from "../dto/user.dto";

/**
 * A person. Firebase owns the login; this row owns everything else.
 * `firebase_uid` is NULL until their first sign-in links it (Firebase Guide §4.6).
 */
@Entity("users")
@Index("UQ_users_email_live", ["email"], { unique: true, where: `"deleted_at" IS NULL` })
@Index("UQ_users_firebase_uid", ["firebaseUid"], { unique: true, where: `"firebase_uid" IS NOT NULL` })
@Check(`"platform_role" IN ('user','support','super_admin')`)
@Check(`"status" IN ('active','disabled')`)
export class User extends BaseEntity {
  @Index()
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id")
  business?: unknown;

  @Column({ name: "firebase_uid", type: "varchar", length: 128, nullable: true })
  firebaseUid: string | null;

  /** Always lower-cased, so the unique index is usable (Backend Guide §10.3). */
  @Column({ type: "varchar", length: 150 })
  email: string;

  @Column({ name: "full_name", type: "varchar", length: 150 })
  fullName: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone: string | null;

  @Column({ name: "platform_role", type: "varchar", length: 20, default: "user" })
  platformRole: PlatformRole;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: UserStatus;

  @Column({ name: "time_zone", type: "varchar", length: 64, default: DEFAULT_TIME_ZONE })
  timeZone: string;

  /** The person asked to delete their account; it is anonymised at this time unless they cancel. */
  @Index("IDX_users_deletion_due", { where: `"deletion_scheduled_for" IS NOT NULL AND "deleted_at" IS NULL` })
  @Column({ name: "deletion_scheduled_for", type: "timestamptz", nullable: true })
  deletionScheduledFor: Date | null;

  /** Progress through the getting-started guide; NULL until it is first opened for them. */
  @Column({ type: "jsonb", nullable: true })
  onboarding: OnboardingState | null;
}
