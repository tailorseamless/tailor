import { Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";

@Entity("measurement_templates")
@Index("UQ_measurement_templates_name_live", ["businessId", "name"], { unique: true, where: `"deleted_at" IS NULL` })
export class MeasurementTemplate extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;
}
