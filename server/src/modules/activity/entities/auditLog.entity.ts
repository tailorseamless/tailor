import { Column, Entity, Index } from "typeorm";
import { AppendOnlyEntity, ForeignKey } from "../../../shared/entities/baseEntity";

/** Who changed what, and when (PRD BR-012). Append-only: never updated or deleted. */
@Entity("audit_logs")
@Index(["businessId", "createdAt"])
@Index(["entityType", "entityId"])
export class AuditLog extends AppendOnlyEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId: string | null;

  @ForeignKey("User", "actor_id", "SET NULL")
  actor?: unknown;

  @Column({ type: "varchar", length: 100 })
  action: string;

  @Column({ name: "entity_type", type: "varchar", length: 50 })
  entityType: string;

  @Column({ name: "entity_id", type: "uuid", nullable: true })
  entityId: string | null;

  @Column({ type: "jsonb", default: () => "'{}'" })
  payload: Record<string, unknown>;
}
