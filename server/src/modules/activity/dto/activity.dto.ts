/** `domain.event`, lower-case (Backend Guide §15). */
export const AUDIT_ACTIONS = [
  "business.registered",
  "business.updated",
  "branch.created",
  "branch.updated",
  "team.member_added",
  "team.member_updated",
  "team.member_removed",
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "customer.portal_link_created",
  "customer.portal_link_revoked",
  "measurement_template.created",
  "measurement_template.updated",
  "measurement_template.deleted",
  "measurement.recorded",
  "measurement.deleted",
  "order.created",
  "order.updated",
  "order.prices_set",
  "order.status_changed",
  "payment.recorded",
  "payment.refunded",
  "payment.voided",
  "appointment.created",
  "appointment.updated",
  "appointment.rescheduled",
  "appointment.status_changed",
  "appointment.customer_confirmed",
  "appointment_request.created",
  "appointment_request.accepted",
  "appointment_request.declined",
  "task.created",
  "task.updated",
  "task.status_changed",
  "material.created",
  "material.updated",
  "material.deleted",
  "material.stock_changed",
  "expense.created",
  "expense.updated",
  "expense.deleted",
  "account.deletion_requested",
  "account.deletion_cancelled",
  "account.deleted",
  "business.deletion_requested",
  "business.deletion_cancelled",
  "business.deleted",
  "admin.business_suspended",
  "admin.business_reactivated",
  "admin.business_updated",
  "admin.user_disabled",
  "admin.user_enabled",
  "admin.role_granted",
  "admin.role_revoked",
  "design.created",
  "design.updated",
  "design.deleted",
  "image.added",
  "image.removed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Who acted. Worked out from the request when not given (see `actorKindFor`). */
export const ACTOR_KINDS = ["user", "admin", "system", "portal", "public"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const AUDIT_OUTCOMES = ["success", "denied", "failed"] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export interface AuditInput {
  /** NULL only for platform events that belong to no business. */
  businessId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** What changed — field names and ids, never personal details. */
  payload?: Record<string, unknown>;
  /** Set it only when the request can't tell (a script acting for the platform). */
  actorKind?: ActorKind;
  outcome?: AuditOutcome;
}

/** One row of the platform audit view: the entry, plus who and which business, by name. */
export interface AuditEntryDTO {
  id: string;
  createdAt: Date;
  action: string;
  outcome: AuditOutcome;
  actorKind: ActorKind;
  actor: { id: string; fullName: string; email: string } | null;
  business: { id: string; name: string } | null;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface ListAuditParams {
  limit: number;
  /** Opaque: the `nextCursor` of the previous page. */
  cursor?: string;
  businessId?: string;
  actorId?: string;
  actorKind?: ActorKind;
  /** An exact action, or a domain prefix ending in a dot ("admin.", "payment."). */
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
}
