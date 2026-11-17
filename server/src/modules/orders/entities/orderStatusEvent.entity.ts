import { Column, Entity, Index } from "typeorm";
import { AppendOnlyEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { OrderStatus } from "../dto/order.dto";

/** Every status change: who, when, from what (PRD US-027). Append-only. */
@Entity("order_status_history")
@Index(["orderId", "createdAt"])
export class OrderStatusEvent extends AppendOnlyEntity {
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @ForeignKey("Order", "order_id", "CASCADE")
  order?: unknown;

  @Column({ name: "from_status", type: "varchar", length: 30, nullable: true })
  fromStatus: OrderStatus | null;

  @Column({ name: "to_status", type: "varchar", length: 30 })
  toStatus: OrderStatus;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @Column({ name: "changed_by", type: "uuid", nullable: true })
  changedBy: string | null;

  @ForeignKey("User", "changed_by", "SET NULL")
  changer?: unknown;
}
