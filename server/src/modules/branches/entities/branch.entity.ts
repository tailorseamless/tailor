import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { BranchStatus } from "../dto/branch.dto";

@Entity("branches")
@Index("UQ_branches_name_live", ["businessId", "name"], { unique: true, where: `"deleted_at" IS NULL` })
@Check(`"status" IN ('active','archived')`)
export class Branch extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "text", nullable: true })
  address: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone: string | null;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: BranchStatus;
}
