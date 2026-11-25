import type { OrderStatus } from "../../orders/dto/order.dto";

/** The emails the app sends, each built from its payload at send time. */
export const EMAIL_KINDS = [
  "team.invitation",
  "appointment.reminder",
  "receipt",
  "appointment.request_received",
  "appointment.request_decided",
  "notification",
  "order.status",
  "admin.alert",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export interface EmailPayloads {
  "team.invitation": { businessName: string; inviteeName: string; inviterName: string; role: string; email: string };
  /** Read fresh at send time: a rescheduled or cancelled appointment is not reminded wrongly. */
  "appointment.reminder": { appointmentId: string };
  /** Built at send time, with the PDF attached; a voided entry is not sent. */
  receipt: { paymentId: string };
  "appointment.request_received": {
    businessName: string;
    name: string;
    type: string;
    preferredStartsAt: string;
    timeZone: string;
  };
  "appointment.request_decided": {
    businessName: string;
    businessPhone: string | null;
    name: string;
    type: string;
    decision: "accepted" | "declined";
    startsAt: string | null;
    timeZone: string;
    note: string | null;
  };
  /** A staff notification's email copy. Read fresh: not sent once it has been read in the app. */
  notification: { notificationId: string };
  /** Built at send time; skipped if the order has moved to another status by then. */
  "order.status": { orderId: string; status: OrderStatus };
  /** A critical alert, to a platform admin. Read fresh: not sent once the alert is resolved. */
  "admin.alert": { alertId: string };
}

export interface QueueEmailInput<K extends EmailKind = EmailKind> {
  /** NULL only for platform emails (to platform admins). */
  businessId: string | null;
  kind: K;
  to: string;
  toName?: string | null;
  payload: EmailPayloads[K];
  /** The same key twice queues once. */
  dedupeKey?: string | null;
}

export interface OutboxRow {
  id: string;
  businessId: string | null;
  kind: EmailKind;
  toAddress: string;
  toName: string | null;
  payload: Record<string, unknown>;
  status: EmailStatus;
  attempts: number;
  createdAt: Date;
}

/** What the business sees of its outbox (no payloads). */
export interface OutboxListItem {
  id: string;
  kind: EmailKind;
  toAddress: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  createdAt: Date;
}
