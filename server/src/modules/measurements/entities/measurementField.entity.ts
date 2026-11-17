import { Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";

/** Only ever reached through its (tenant-scoped) template, so it carries no business_id (Backend Guide §9.2). */
@Entity("measurement_fields")
@Index("UQ_measurement_fields_name_live", ["templateId", "name"], { unique: true, where: `"deleted_at" IS NULL` })
@Index(["templateId", "position"])
export class MeasurementField extends BaseEntity {
  @Column({ name: "template_id", type: "uuid" })
  templateId: string;

  @ForeignKey("MeasurementTemplate", "template_id", "CASCADE")
  template?: unknown;

  @Column({ type: "varchar", length: 80 })
  name: string;

  @Column({ type: "integer", default: 0 })
  position: number;

  @Column({ name: "is_required", type: "boolean", default: false })
  isRequired: boolean;
}
