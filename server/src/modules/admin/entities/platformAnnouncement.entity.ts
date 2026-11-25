import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ForeignKey } from "../../../shared/entities/baseEntity";
import type { AnnouncementAudience, AnnouncementStatus } from "../dto/announcement.dto";

/**
 * A message from Tailor Seamless to the businesses on the platform, delivered as an in-app
 * notification (and push, for those who allow it) by the `deliverAnnouncements` job, a batch of
 * businesses at a time. `cursor_business_id` is how far it has got, so a restart resumes, never repeats.
 */
@Entity("platform_announcements")
@Index("IDX_platform_announcements_status", ["status", "createdAt"])
@Check(`"audience" IN ('owners','everyone')`)
@Check(`"status" IN ('queued','sending','sent','cancelled')`)
export class PlatformAnnouncement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @Column({ name: "author_id", type: "uuid", nullable: true })
  authorId: string | null;

  @ForeignKey("User", "author_id", "SET NULL")
  author?: unknown;

  @Column({ type: "varchar", length: 120 })
  title: string;

  @Column({ type: "text" })
  body: string;

  /** Where tapping it goes, inside the app ("/settings"); NULL opens the notifications list. */
  @Column({ name: "link_path", type: "varchar", length: 300, nullable: true })
  linkPath: string | null;

  /** `owners`: each business's owner; `everyone`: every active person on every team. */
  @Column({ type: "varchar", length: 20 })
  audience: AnnouncementAudience;

  @Column({ type: "varchar", length: 20, default: "queued" })
  status: AnnouncementStatus;

  /** The last business delivered to, in id order; NULL before the first batch. */
  @Column({ name: "cursor_business_id", type: "uuid", nullable: true })
  cursorBusinessId: string | null;

  @Column({ name: "businesses_reached", type: "integer", default: 0 })
  businessesReached: number;

  /** People it was delivered to (those who turned announcements off are not counted). */
  @Column({ type: "integer", default: 0 })
  recipients: number;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt: Date | null;
}
