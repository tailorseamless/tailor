import type { ISODate } from "./api.types";
import type { MeasurementUnit } from "./auth.types";
import type { MeasurementValue } from "./customer.types";

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
  /** The style the request was made from; null for other requests, or once that design is deleted. */
  design: {
    id: string;
    name: string;
    category: string | null;
    priceMin: number | null;
    priceMax: number | null;
    coverUrl: string | null;
  } | null;
  /** What another tailor measured, sent by the customer; null when they sent none. */
  measurements: MeasurementValue[] | null;
  measurementUnit: MeasurementUnit | null;
  status: RequestStatus;
  createdAt: ISODate;
}
