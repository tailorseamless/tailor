import { Check, Column, Entity, Index } from "typeorm";
import { DEFAULT_CURRENCY, DEFAULT_TIME_ZONE } from "../../../config/constants";
import { BaseEntity } from "../../../shared/entities/baseEntity";
import type { BusinessStatus, MeasurementUnit } from "../dto/business.dto";

/** The tenant: a fashion business and its isolated workspace (PRD BR-001). */
@Entity("businesses")
@Check(`"status" IN ('active','suspended')`)
@Check(`"measurement_unit" IN ('in','cm')`)
export class Business extends BaseEntity {
  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  email: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone: string | null;

  @Column({ type: "text", nullable: true })
  address: string | null;

  @Column({ type: "varchar", length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Column({ name: "time_zone", type: "varchar", length: 64, default: DEFAULT_TIME_ZONE })
  timeZone: string;

  @Column({ name: "measurement_unit", type: "varchar", length: 2, default: "in" })
  measurementUnit: MeasurementUnit;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: BusinessStatus;

  /** Running count of orders taken; the source of order numbers. Only ever incremented atomically. */
  @Column({ name: "order_seq", type: "integer", default: 0 })
  orderSeq: number;

  /** Running count of receipts issued; the source of receipt numbers. */
  @Column({ name: "receipt_seq", type: "integer", default: 0 })
  receiptSeq: number;

  /** Email customers their appointment reminders (when they have an email address). */
  @Column({ name: "email_customer_reminders", type: "boolean", default: true })
  emailCustomerReminders: boolean;

  /** Email customers a receipt, with the PDF, for every payment and refund. */
  @Column({ name: "email_receipts", type: "boolean", default: true })
  emailReceipts: boolean;

  /** Email customers when their order is ready for a fitting, ready to collect, or delivered. */
  @Column({ name: "email_order_updates", type: "boolean", default: true })
  emailOrderUpdates: boolean;

  /** The public page address: <APP_URL>/<slug>. */
  @Index("UQ_businesses_slug", { unique: true, where: `"slug" IS NOT NULL` })
  @Column({ type: "varchar", length: 60, nullable: true })
  slug: string | null;

  /** The public page (designs, price ranges, contact details) is published at the slug. */
  @Column({ name: "page_enabled", type: "boolean", default: false })
  pageEnabled: boolean;

  /** Accept appointment requests from the public page. Only meaningful while the page is published. */
  @Column({ name: "booking_enabled", type: "boolean", default: false })
  bookingEnabled: boolean;

  /** The owner asked to delete the business; it is anonymised at this time unless they cancel. */
  @Index("IDX_businesses_deletion_due", { where: `"deletion_scheduled_for" IS NOT NULL AND "deleted_at" IS NULL` })
  @Column({ name: "deletion_scheduled_for", type: "timestamptz", nullable: true })
  deletionScheduledFor: Date | null;
}
