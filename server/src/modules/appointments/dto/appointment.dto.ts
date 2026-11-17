/** Why the customer is coming in (PRD §3.6). */
export const APPOINTMENT_TYPES = ["measurement", "consultation", "fitting", "alteration", "collection"] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** The ways a scheduled appointment can end. */
export const APPOINTMENT_OUTCOMES = ["completed", "cancelled", "no_show"] as const;
export type AppointmentOutcome = (typeof APPOINTMENT_OUTCOMES)[number];

export const APPOINTMENT_LIMITS = {
  minMinutes: 5,
  maxMinutes: 480,
  defaultMinutes: 30,
  /** Reminder lead time: default an hour, at most a week. */
  defaultReminderMinutes: 60,
  maxReminderMinutes: 10_080,
  /** Clashing appointments named in a 409. */
  clashesShown: 5,
} as const;

export interface AppointmentRecord {
  id: string;
  businessId: string;
  customerId: string;
  /** The order this visit is about, if any. */
  orderId: string | null;
  branchId: string | null;
  /** The staff member who will see the customer, if decided. */
  assignedTo: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: Date;
  durationMinutes: number;
  notes: string | null;
  /** Why it was last rescheduled, cancelled or missed. */
  changeNote: string | null;
  /** Remind this long before it starts; NULL = no reminder. */
  reminderMinutesBefore: number | null;
  reminderSentAt: Date | null;
  createdBy: string | null;
  /** The customer confirmed from their portal. */
  customerConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentDTO extends AppointmentRecord {
  customerName: string;
  customerPhone: string;
  orderNumber: string | null;
  assignedName: string | null;
}

/** What a clash check compares against. */
export interface AppointmentSlot {
  customerId: string;
  assignedTo: string | null;
  startsAt: Date;
  durationMinutes: number;
}

/** A reminder that has just been claimed for sending. */
export interface DueReminder {
  id: string;
  businessId: string;
  /** The assignee, or whoever booked it. */
  userId: string | null;
  type: AppointmentType;
  startsAt: Date;
  customerName: string;
  customerEmail: string | null;
  /** The business emails customers their reminders. */
  emailCustomer: boolean;
  timeZone: string;
}

export interface ListAppointmentsParams {
  businessId: string;
  page: number;
  limit: number;
  /** `asc` = soonest first (the default), `desc` = latest first. */
  order: "asc" | "desc";
  status?: AppointmentStatus;
  type?: AppointmentType;
  customerId?: string;
  orderId?: string;
  branchId?: string;
  assignedTo?: string;
  /** One calendar day, `YYYY-MM-DD`, in `timeZone`. */
  day?: string;
  timeZone: string;
  /** `starts_at` range, inclusive start / exclusive end. */
  from?: Date;
  to?: Date;
}
