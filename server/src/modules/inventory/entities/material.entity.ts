import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import { MATERIAL_CATEGORIES, type MaterialCategory } from "../dto/inventory.dto";

@Entity("materials")
@Index("UQ_materials_name_live", ["businessId", "name"], { unique: true, where: `"deleted_at" IS NULL` })
@Index(["businessId", "category"])
@Index(["businessId", "branchId"]) // one branch's stock
@Check(`"category" IN (${MATERIAL_CATEGORIES.map((value) => `'${value}'`).join(",")})`)
@Check(`"quantity" >= 0`)
export class Material extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  /** Where the stock is kept. NULL = not tied to a branch. */
  @Column({ name: "branch_id", type: "uuid", nullable: true })
  branchId: string | null;

  @ForeignKey("Branch", "branch_id", "RESTRICT")
  branch?: unknown;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 20, default: "other" })
  category: MaterialCategory;

  @Column({ type: "varchar", length: 20 })
  unit: string;

  @Column({ type: "numeric", precision: 14, scale: 3, default: 0, transformer: numericTransformer })
  quantity: number;

  @Column({
    name: "unit_cost",
    type: "numeric",
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  unitCost: number | null;

  @Column({
    name: "min_quantity",
    type: "numeric",
    precision: 14,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  minQuantity: number | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  supplier: string | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;
}
