import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { AppointmentType } from "../../appointments/dto/appointment.dto";
import type { RequestSource, RequestStatus } from "../dto/request.dto";

@Entity("appointment_requests")
@Index(["businessId", "status", "createdAt"]) // the inbox
@Index(["businessId", "phone", "status"]) // pending requests per phone (abuse limit)
@Index(["customerId"])
@Check(`"source" IN ('portal','booking_page')`)
@Check(`"status" IN ('pending','accepted','declined')`)
export class AppointmentRequest extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "customer_id", type: "uuid", nullable: true })
  customerId: string | null;

  @ForeignKey("Customer", "customer_id", "SET NULL")
  customer?: unknown;

  @Column({ type: "varchar", length: 20 })
  source: RequestSource;

  @Column({ name: "full_name", type: "varchar", length: 150 })
  fullName: string;

  @Column({ type: "varchar", length: 30 })
  phone: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  email: string | null;

  @Column({ type: "varchar", length: 20 })
  type: AppointmentType;

  @Column({ name: "preferred_starts_at", type: "timestamptz" })
  preferredStartsAt: Date;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: RequestStatus;

  @Column({ name: "appointment_id", type: "uuid", nullable: true })
  appointmentId: string | null;

  @ForeignKey("Appointment", "appointment_id", "SET NULL")
  appointment?: unknown;

  @Column({ name: "decided_by", type: "uuid", nullable: true })
  decidedBy: string | null;

  @ForeignKey("User", "decided_by", "SET NULL")
  decider?: unknown;

  @Column({ name: "decided_at", type: "timestamptz", nullable: true })
  decidedAt: Date | null;

  @Column({ name: "decision_note", type: "text", nullable: true })
  decisionNote: string | null;
}
