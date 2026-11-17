import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { CustomerGender } from "../dto/customer.dto";

/**
 * Soft-deleted only: removing a customer never removes their order or payment
 * history (PRD BR-014).
 */
@Entity("customers")
@Index(["businessId", "createdAt"]) // default list order
@Index(["businessId", "fullName"]) // list sorted by name
@Index(["businessId", "phone"]) // duplicate check, lookup by number
@Check(`"gender" IS NULL OR "gender" IN ('female','male','other')`)
export class Customer extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "full_name", type: "varchar", length: 150 })
  fullName: string;

  @Column({ type: "varchar", length: 30 })
  phone: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  email: string | null;

  @Column({ type: "text", nullable: true })
  address: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  gender: CustomerGender | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy: string | null;

  @ForeignKey("User", "created_by", "SET NULL")
  creator?: unknown;

  /** SHA-256 of the customer's portal link secret. The secret itself is shown once and never stored. */
  @Index("UQ_customers_portal_token", { unique: true, where: `"portal_token_hash" IS NOT NULL` })
  @Column({ name: "portal_token_hash", type: "varchar", length: 64, nullable: true, select: false })
  portalTokenHash: string | null;

  @Column({ name: "portal_link_created_at", type: "timestamptz", nullable: true })
  portalLinkCreatedAt: Date | null;
}
