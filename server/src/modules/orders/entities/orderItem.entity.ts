import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import type { FabricSource } from "../dto/order.dto";

/** One garment on an order. Reached only through its (tenant-scoped) order. */
@Entity("order_items")
@Index(["orderId", "position"])
@Check(`"quantity" > 0`)
@Check(`"unit_price" >= 0`)
@Check(`"fabric_source" IN ('customer','business')`)
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
