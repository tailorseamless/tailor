import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import type { DesignVisibility } from "../dto/design.dto";

@Entity("designs")
@Index(["businessId", "createdAt"]) // the catalogue, newest first
@Index(["businessId", "category"])
@Index(["businessId", "visibility"]) // what customers may see
@Check(`"visibility" IN ('private','customers')`)
@Check(
  "CHK_designs_price_range",
  `("price_min" IS NULL OR "price_min" >= 0) AND ("price_max" IS NULL OR "price_max" >= 0) AND ("price_min" IS NULL OR "price_max" IS NULL OR "price_min" <= "price_max")`,
)
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

  /** The lowest price this style usually costs. With no highest price it reads "from …". */
  @Column({
    name: "price_min",
    type: "numeric",
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  priceMin: number | null;

  /** The highest price this style usually costs. With no lowest price it reads "up to …". */
  @Column({
    name: "price_max",
    type: "numeric",
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  priceMax: number | null;

  @Column({ type: "varchar", length: 20, default: "private" })
  visibility: DesignVisibility;

  @Column({ name: "is_favourite", type: "boolean", default: false })
  isFavourite: boolean;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy: string | null;

  @ForeignKey("User", "created_by", "SET NULL")
  creator?: unknown;
}
