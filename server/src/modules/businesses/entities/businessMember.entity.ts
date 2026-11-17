import { Check, Column, Entity, Index } from "typeorm";
import { MEMBER_ROLES, type MemberRole } from "../../../config/permissions";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { MemberStatus } from "../dto/business.dto";

/** A person's place in a business. Roles are derived from this row (Backend Guide §23.1). */
@Entity("business_members")
@Index("UQ_business_members_live", ["businessId", "userId"], { unique: true, where: `"deleted_at" IS NULL` })
@Index(["businessId", "status"])
@Check(`"role" IN (${MEMBER_ROLES.map((role) => `'${role}'`).join(",")})`)
@Check(`"status" IN ('active','suspended')`)
export class BusinessMember extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ForeignKey("User", "user_id", "CASCADE")
  user?: unknown;

  /** Their home branch: new orders, appointments and expenses they record default to it. */
  @Column({ name: "branch_id", type: "uuid", nullable: true })
  branchId: string | null;

  @ForeignKey("Branch", "branch_id", "RESTRICT")
  branch?: unknown;

  @Column({ type: "varchar", length: 20 })
  role: MemberRole;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: MemberStatus;
}
