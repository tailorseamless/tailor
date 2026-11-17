import type { AppointmentType } from "../../appointments/dto/appointment.dto";

/** Where the request came from: a customer's portal link, or the business's public booking page. */
export const REQUEST_SOURCES = ["portal", "booking_page"] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];

export const REQUEST_STATUSES = ["pending", "accepted", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** An online appointment request (PRD Phase 3). It becomes an appointment only when staff accept it. */
export interface AppointmentRequestRecord {
  id: string;
  businessId: string;
  /** Known when it came through the portal, or once accepted. */
  customerId: string | null;
  source: RequestSource;
  fullName: string;
  phone: string;
  email: string | null;
  type: AppointmentType;
  preferredStartsAt: Date;
  note: string | null;
  status: RequestStatus;
  appointmentId: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListRequestsParams {
  businessId: string;
  page: number;
  limit: number;
  status?: RequestStatus;
  customerId?: string;
}

export interface NewRequestInput {
  businessId: string;
  customerId: string | null;
  source: RequestSource;
  fullName: string;
  phone: string;
  email: string | null;
  type: AppointmentType;
  preferredStartsAt: Date;
  note: string | null;
}
