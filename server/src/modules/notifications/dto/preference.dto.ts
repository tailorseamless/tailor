import { NOTIFICATION_TYPES, type NotificationType } from "./notification.dto";

/** How each type reads in the settings screen. A new type needs a label here. */
export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  "appointment.reminder": "Reminders before your appointments",
  "task.assigned": "A task is given to you",
  "appointment.requested": "A customer asks for an appointment online",
  "appointment.confirmed": "A customer confirms an appointment",
  "platform.announcement": "News and announcements from Tailor Seamless",
  "platform.support_change": "Tailor Seamless support changes something for you",
};

/** Emailed unless switched off. The rest are opt-in for email: they are frequent, or the app covers them. */
export const EMAIL_ON_BY_DEFAULT: readonly NotificationType[] = [
  "task.assigned",
  "appointment.requested",
  "platform.support_change", // someone outside the business made something public
];

export interface ChannelChoice {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface PreferenceDTO extends ChannelChoice {
  type: NotificationType;
  label: string;
}

export interface PreferencesDTO {
  preferences: PreferenceDTO[];
  /** Push can work on this server (FCM configured). */
  pushAvailable: boolean;
  /** Browsers this person has registered for push. */
  devices: number;
}

export function defaultChoice(type: NotificationType): ChannelChoice {
  return { inApp: true, email: EMAIL_ON_BY_DEFAULT.includes(type), push: true };
}

/** Email and push are copies of the in-app notification, so they follow it (Backend Guide §26.1). */
export function normaliseChoice(choice: ChannelChoice): ChannelChoice {
  return choice.inApp ? choice : { inApp: false, email: false, push: false };
}

export { NOTIFICATION_TYPES };
