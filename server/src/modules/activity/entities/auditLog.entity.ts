import { Check, Column, Entity, Index } from "typeorm";
import { AppendOnlyEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import type { ActorKind, AuditOutcome } from "../dto/activity.dto";

/**
 * Who changed what, and when (PRD BR-012). Append-only: never updated or deleted.
 * `business_id` is NULL for platform events that belong to no business (an admin granted, say).
 */
@Entity("audit_logs")
@Index(["businessId", "createdAt"])
@Index(["entityType", "entityId"])
@Index("IDX_audit_logs_created", ["createdAt"]) // the platform-wide audit view, newest first
@Index("IDX_audit_logs_actor", ["actorId", "createdAt"]) // everything one person did
@Check(`"actor_kind" IN ('user','admin','system','portal','public')`)
@Check(`"outcome" IN ('success','denied','failed')`)
export class AuditLog extends AppendOnlyEntity {
  @Column({ name: "business_id", type: "uuid", nullable: true })
  businessId: string | null;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId: string | null;

  @ForeignKey("User", "actor_id", "SET NULL")
  actor?: unknown;

  /** What kind of actor: a signed-in person, a platform admin, a job, a customer's portal link, the public. */
  @Column({ name: "actor_kind", type: "varchar", length: 20, default: "user" })
  actorKind: ActorKind;

  @Column({ type: "varchar", length: 100 })
  action: string;

  @Column({ name: "entity_type", type: "varchar", length: 50 })
  entityType: string;

  @Column({ name: "entity_id", type: "uuid", nullable: true })
  entityId: string | null;

  @Column({ type: "jsonb", default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: "success" })
  outcome: AuditOutcome;

  /** The X-Request-Id of the request that made the change; NULL for jobs and scripts. */
  @Column({ name: "request_id", type: "varchar", length: 100, nullable: true })
  requestId: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip: string | null;

  @Column({ name: "user_agent", type: "varchar", length: 200, nullable: true })
  userAgent: string | null;
}
