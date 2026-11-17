import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { DesignVisibility } from "../dto/design.dto";

@Entity("designs")
@Index(["businessId", "createdAt"]) // the catalogue, newest first
@Index(["businessId", "category"])
@Index(["businessId", "visibility"]) // what customers may see
@Check(`"visibility" IN ('private','customers')`)
export class Design extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", length: 60, nullable: true })
  category: string | null;

  @Column({ type: "varchar", length: 20, default: "private" })
  visibility: DesignVisibility;

  @Column({ name: "is_favourite", type: "boolean", default: false })
  isFavourite: boolean;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy: string | null;

  @ForeignKey("User", "created_by", "SET NULL")
  creator?: unknown;
}
