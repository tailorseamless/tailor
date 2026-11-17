import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import { ORDER_STATUSES, type OrderStatus } from "../dto/order.dto";

@Entity("orders")
@Index("UQ_orders_number", ["businessId", "orderNumber"], { unique: true })
@Index(["businessId", "createdAt"]) // default list order
@Index(["businessId", "status"]) // filter by stage
@Index(["businessId", "dueDate"]) // due-date filters, overdue
@Index(["businessId", "customerId"]) // a customer's order history
@Index(["businessId", "branchId"]) // one branch's orders
@Check(`"status" IN (${ORDER_STATUSES.map((status) => `'${status}'`).join(",")})`)
@Check(`"total_amount" >= 0`)
export class Order extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "customer_id", type: "uuid" })
  customerId: string;

  /** RESTRICT: a customer with orders can only ever be soft-deleted (PRD BR-014). */
  @ForeignKey("Customer", "customer_id", "RESTRICT")
  customer?: unknown;

  /** The shop the order was taken at, if the business uses branches. */
  @Column({ name: "branch_id", type: "uuid", nullable: true })
  branchId: string | null;

  @ForeignKey("Branch", "branch_id", "RESTRICT")
  branch?: unknown;

  @Column({ name: "order_number", type: "varchar", length: 30 })
  orderNumber: string;

  @Column({ type: "varchar", length: 30, default: "confirmed" })
  status: OrderStatus;

  @Column({ name: "due_date", type: "date", nullable: true })
  dueDate: string | null;

  @Column({ name: "total_amount", type: "numeric", precision: 14, scale: 2, transformer: numericTransformer })
  totalAmount: number;

  @Column({ type: "varchar", length: 3 })
  currency: string;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy: string | null;

  @ForeignKey("User", "created_by", "SET NULL")
  creator?: unknown;

  @Column({ name: "delivered_at", type: "timestamptz", nullable: true })
  deliveredAt: Date | null;
}
