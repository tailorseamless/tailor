import type { AppointmentOutcome, AppointmentStatus } from "../dto/appointment.dto";

/** The appointment lifecycle — pure rules, no I/O (Backend Guide §27.3). */

/** Only an appointment that is still booked can be completed, cancelled or marked missed. */
export const canCloseAppointment = (from: AppointmentStatus, _to: AppointmentOutcome): boolean => from === "scheduled";

/** A booked appointment can move; a missed one can be rebooked. Completed and cancelled are final. */
export const canReschedule = (status: AppointmentStatus): boolean => status === "scheduled" || status === "no_show";

/** Details can change only while it is still booked. */
export const canEditAppointment = (status: AppointmentStatus): boolean => status === "scheduled";

/** "no_show" → "missed", for messages. */
export const statusLabel = (status: AppointmentStatus): string => (status === "no_show" ? "missed" : status);
