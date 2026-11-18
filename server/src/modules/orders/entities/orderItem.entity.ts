import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import type { DiscountType } from "../domain/orderMoney";
import type { FabricSource } from "../dto/order.dto";

/** One garment on an order. Reached only through its (tenant-scoped) order. */
@Entity("order_items")
@Index(["orderId", "position"])
@Check(`"quantity" > 0`)
@Check(`"unit_price" >= 0`)
@Check(`"fabric_source" IN ('customer','business')`)
@Check(`("estimate_min" IS NULL) = ("estimate_max" IS NULL)`)
@Check(`"estimate_min" IS NULL OR ("estimate_min" >= 0 AND "estimate_min" <= "estimate_max")`)
@Check(`"discount_type" IS NULL OR "discount_type" IN ('amount','percent')`)
@Check(`("discount_type" IS NULL) = ("discount_value" IS NULL)`)
@Check(`"discount_value" IS NULL OR "discount_value" >= 0`)
@Check(`"discount_type" IS DISTINCT FROM 'percent' OR "discount_value" <= 100`)
@Check(`"discount_amount" >= 0`)
export class OrderItem extends BaseEntity {
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @ForeignKey("Order", "order_id", "CASCADE")
  order?: unknown;

  @Column({ name: "garment_name", type: "varchar", length: 150 })
  garmentName: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "integer", default: 1 })
  quantity: number;

  @Column({ name: "unit_price", type: "numeric", precision: 14, scale: 2, transformer: numericTransformer })
  unitPrice: number;

  /** A quote for ONE piece, given before the price is agreed. Both set or both null. */
  @Column({
    name: "estimate_min",
    type: "numeric",
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  estimateMin: number | null;

  @Column({
    name: "estimate_max",
    type: "numeric",
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  estimateMax: number | null;

  /** Off the whole line: a fixed amount, or a percentage of it. */
  @Column({ name: "discount_type", type: "varchar", length: 10, nullable: true })
  discountType: DiscountType | null;

  @Column({
    name: "discount_value",
    type: "numeric",
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  discountValue: number | null;

  /** What the discount comes to in money at the agreed price (kept so sums and reports need no arithmetic). */
  @Column({
    name: "discount_amount",
    type: "numeric",
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discountAmount: number;

  @Column({ name: "fabric_source", type: "varchar", length: 10, default: "customer" })
  fabricSource: FabricSource;

  @Index()
  @Column({ name: "measurement_id", type: "uuid", nullable: true })
  measurementId: string | null;

  /** The catalogue design the customer chose, if any (PRD §4.5). */
  @Index()
  @Column({ name: "design_id", type: "uuid", nullable: true })
  designId: string | null;

  @ForeignKey("Design", "design_id", "RESTRICT")
  design?: unknown;

  /** Measurement records are immutable and only soft-deleted, so this stays the version used. */
  @ForeignKey("CustomerMeasurement", "measurement_id", "RESTRICT")
  measurement?: unknown;

  @Column({ type: "integer", default: 0 })
  position: number;
}
