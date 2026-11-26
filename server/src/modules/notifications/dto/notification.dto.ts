/** The registry of notification types, `domain.event` (Backend Guide §26.1). */
export const NOTIFICATION_TYPES = [
  "appointment.reminder",
  "task.assigned",
  "appointment.requested",
  "appointment.confirmed",
  "platform.announcement",
  "platform.support_change",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** In-app path to open, e.g. `/appointments/<id>`. */
  linkPath: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotifyInput {
  businessId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string | null;
  linkPath?: string | null;
  /** The same key twice is a no-op, so a repeated call never notifies twice. */
  dedupeKey?: (userId: string) => string;
}
