import type { AppointmentType } from "../dto/appointment.dto";

/** Reminder wording — pure, no I/O. */

const TYPE_LABEL: Record<AppointmentType, string> = {
  measurement: "Measurement",
  consultation: "Design consultation",
  fitting: "Fitting",
  alteration: "Alteration",
  collection: "Collection",
};

/** "Tue 10 Mar, 10:00" in the business's own zone; an unknown zone falls back to UTC. */
export function localTime(at: Date, timeZone: string): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
  try {
    return format(timeZone);
  } catch {
    return format("UTC");
  }
}

export function reminderText(appointment: {
  type: AppointmentType;
  customerName: string;
  startsAt: Date;
  timeZone: string;
}): { title: string; body: string } {
  return {
    title: `${TYPE_LABEL[appointment.type]} with ${appointment.customerName}`,
    body: `Starts ${localTime(appointment.startsAt, appointment.timeZone)}`,
  };
}
