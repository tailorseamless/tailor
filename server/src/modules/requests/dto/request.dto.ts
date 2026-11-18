import type { AppointmentType } from "../../appointments/dto/appointment.dto";
import type { MeasurementUnit } from "../../businesses/dto/business.dto";
import type { DesignSummaryDTO } from "../../designs/dto/design.dto";
import type { MeasurementValue } from "../../measurements/dto/measurement.dto";

export const REQUEST_LIMITS = {
  /** Measurements a customer can send along with a request. */
  maxMeasurements: 20,
  maxMeasurementName: 60,
} as const;

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
  /** The design it was made from ("Book a fitting" on a style); null for any other request. */
  designId: string | null;
  /** What an earlier tailor measured, sent by the customer; null when they sent none. */
  measurements: MeasurementValue[] | null;
  measurementUnit: MeasurementUnit | null;
  status: RequestStatus;
  appointmentId: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A request as staff see it: with the design it was made from, when there is one and it still exists. */
export interface AppointmentRequestDTO extends AppointmentRequestRecord {
  design: DesignSummaryDTO | null;
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
  designId: string | null;
  measurements: MeasurementValue[] | null;
  measurementUnit: MeasurementUnit | null;
}
