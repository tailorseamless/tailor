import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { MeasurementUnit } from "../../businesses/dto/business.dto";
import type { MeasurementValue } from "../dto/measurement.dto";

/**
 * One measuring session. Rows are never edited: a re-measure is a new row
 * (PRD BR-006), and the values are a snapshot, not links to template fields.
 */
@Entity("customer_measurements")
@Index(["businessId", "customerId", "measuredOn"]) // a customer's history, newest first
@Check(`"unit" IN ('in','cm')`)
export class CustomerMeasurement extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Index()
  @Column({ name: "customer_id", type: "uuid" })
  customerId: string;

  @ForeignKey("Customer", "customer_id", "RESTRICT")
  customer?: unknown;

  @Column({ name: "template_id", type: "uuid", nullable: true })
  templateId: string | null;

  @ForeignKey("MeasurementTemplate", "template_id", "SET NULL")
  template?: unknown;

  @Column({ name: "template_name", type: "varchar", length: 100, nullable: true })
  templateName: string | null;

  @Column({ type: "varchar", length: 2 })
  unit: MeasurementUnit;

  @Column({ name: "measured_on", type: "date" })
  measuredOn: string;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  /** `[{ name, value }]` in display order. */
  @Column({ type: "jsonb", default: () => "'[]'" })
  entries: MeasurementValue[];

  @Column({ name: "recorded_by", type: "uuid", nullable: true })
  recordedBy: string | null;

  @ForeignKey("User", "recorded_by", "SET NULL")
  recorder?: unknown;
}
