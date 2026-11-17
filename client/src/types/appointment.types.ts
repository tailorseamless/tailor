import type { ISODate } from "./api.types";

export type AppointmentType = "measurement" | "consultation" | "fitting" | "alteration" | "collection";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  customerId: string;
  orderId: string | null;
  assignedTo: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: ISODate;
  durationMinutes: number;
  notes: string | null;
  customerConfirmedAt: ISODate | null;
  customerName: string;
  customerPhone: string;
  orderNumber: string | null;
  assignedName: string | null;
}

export interface AppointmentInput {
  customerId: string;
  orderId?: string | null;
  type: AppointmentType;
  startsAt: string;
  durationMinutes: number;
  reminderMinutesBefore: number | null;
  notes?: string | null;
  confirmClash?: boolean;
}

export type RequestStatus = "pending" | "accepted" | "declined";

export interface AppointmentRequest {
  id: string;
  customerId: string | null;
  source: "portal" | "booking_page";
  fullName: string;
  phone: string;
  email: string | null;
  type: AppointmentType;
  preferredStartsAt: ISODate;
  note: string | null;
  status: RequestStatus;
  createdAt: ISODate;
}
