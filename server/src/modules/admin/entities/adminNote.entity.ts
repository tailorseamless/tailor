import { Column, Entity, Index } from "typeorm";
import { AppendOnlyEntity, ForeignKey } from "../../../shared/entities/baseEntity";

/**
 * A platform admin's note about a business ("called the owner about the failed emails"). Seen by
 * platform admins only, never by the business. Append-only: a correction is a new note.
 */
@Entity("admin_notes")
@Index("IDX_admin_notes_business", ["businessId", "createdAt"])
export class AdminNote extends AppendOnlyEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "author_id", type: "uuid", nullable: true })
  authorId: string | null;

  @ForeignKey("User", "author_id", "SET NULL")
  author?: unknown;

  @Column({ type: "text" })
  body: string;
}
