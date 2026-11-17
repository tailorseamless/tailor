import { Check, Column, Entity, Index } from "typeorm";
import { AppendOnlyEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import type { PaymentKind, PaymentMethod } from "../dto/payment.dto";

/**
 * The payment ledger. Append-only: rows are never updated or deleted, and a
 * mistake is corrected by a `void` row pointing at it (PRD §3.5, BR-012).
 */
@Entity("payments")
@Index(["orderId", "createdAt"]) // an order's entries; net-paid sum
@Index(["businessId", "paidAt"]) // payments by date
@Index(["businessId", "customerId"]) // a customer's payment history
@Index("UQ_payments_receipt", ["businessId", "receiptNumber"], {
  unique: true,
  where: `"receipt_number" IS NOT NULL`,
})
// An entry can be voided once only.
@Index("UQ_payments_reverses", ["reversesPaymentId"], { unique: true, where: `"reverses_payment_id" IS NOT NULL` })
@Check(`"kind" IN ('payment','refund','void')`)
@Check(`"method" IN ('cash','bank_transfer','pos','other')`)
@Check(`"amount" > 0`)
@Check(`("kind" = 'void') = ("reverses_payment_id" IS NOT NULL)`)
export class Payment extends AppendOnlyEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "RESTRICT")
  business?: unknown;

  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @ForeignKey("Order", "order_id", "RESTRICT")
  order?: unknown;

  @Column({ name: "customer_id", type: "uuid" })
  customerId: string;

  @ForeignKey("Customer", "customer_id", "RESTRICT")
  customer?: unknown;

  @Column({ type: "varchar", length: 10 })
  kind: PaymentKind;

  @Column({ type: "numeric", precision: 14, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ type: "varchar", length: 20 })
  method: PaymentMethod;

  @Column({ type: "varchar", length: 100, nullable: true })
  reference: string | null;

  @Column({ name: "paid_at", type: "timestamptz" })
  paidAt: Date;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @Column({ name: "receipt_number", type: "varchar", length: 30, nullable: true })
  receiptNumber: string | null;

  @Column({ name: "reverses_payment_id", type: "uuid", nullable: true })
  reversesPaymentId: string | null;

  @ForeignKey("Payment", "reverses_payment_id", "RESTRICT")
  reverses?: unknown;

  @Column({ name: "recorded_by", type: "uuid", nullable: true })
  recordedBy: string | null;

  @ForeignKey("User", "recorded_by", "SET NULL")
  recorder?: unknown;
}
