import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  type AppointmentStatus,
  type AppointmentType,
} from "../dto/appointment.dto";

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(",");

@Entity("appointments")
@Index(["businessId", "startsAt"]) // the diary: a day, a range, what's next
@Index(["businessId", "customerId"]) // a customer's appointment history
@Index(["businessId", "branchId", "startsAt"]) // one branch's diary
@Index(["businessId", "assignedTo", "startsAt"]) // one person's diary
// The reminder job's scan: only appointments still waiting for a reminder.
@Index("IDX_appointments_reminder_due", ["startsAt"], {
  where: `"status" = 'scheduled' AND "reminder_minutes_before" IS NOT NULL AND "reminder_sent_at" IS NULL AND "deleted_at" IS NULL`,
})
@Check(`"type" IN (${list(APPOINTMENT_TYPES)})`)
@Check(`"status" IN (${list(APPOINTMENT_STATUSES)})`)
@Check(`"duration_minutes" > 0`)
@Check(`"reminder_minutes_before" IS NULL OR "reminder_minutes_before" > 0`)
export class Appointment extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "customer_id", type: "uuid" })
  customerId: string;

  @ForeignKey("Customer", "customer_id", "RESTRICT")
  customer?: unknown;

  @Index()
  @Column({ name: "order_id", type: "uuid", nullable: true })
  orderId: string | null;

  @ForeignKey("Order", "order_id", "RESTRICT")
  order?: unknown;

  /** Where the visit happens, if the business uses branches. */
  @Column({ name: "branch_id", type: "uuid", nullable: true })
  branchId: string | null;

  @ForeignKey("Branch", "branch_id", "RESTRICT")
  branch?: unknown;

  @Column({ name: "assigned_to", type: "uuid", nullable: true })
  assignedTo: string | null;

  @ForeignKey("User", "assigned_to", "SET NULL")
  assignee?: unknown;

  @Column({ type: "varchar", length: 20 })
  type: AppointmentType;

  @Column({ type: "varchar", length: 20, default: "scheduled" })
  status: AppointmentStatus;

  @Column({ name: "starts_at", type: "timestamptz" })
  startsAt: Date;

  @Column({ name: "duration_minutes", type: "integer", default: 30 })
  durationMinutes: number;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "change_note", type: "text", nullable: true })
  changeNote: string | null;

  @Column({ name: "reminder_minutes_before", type: "integer", nullable: true })
  reminderMinutesBefore: number | null;

  @Column({ name: "reminder_sent_at", type: "timestamptz", nullable: true })
  reminderSentAt: Date | null;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy: string | null;

  @ForeignKey("User", "created_by", "SET NULL")
  creator?: unknown;

  /** The customer confirmed from their portal. Cleared when it is rescheduled. */
  @Column({ name: "customer_confirmed_at", type: "timestamptz", nullable: true })
  customerConfirmedAt: Date | null;
}
