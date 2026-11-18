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
  "design.created",
  "design.updated",
  "design.deleted",
  "image.added",
  "image.removed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditInput {
  businessId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** What changed — field names and ids, never personal details. */
  payload?: Record<string, unknown>;
}
