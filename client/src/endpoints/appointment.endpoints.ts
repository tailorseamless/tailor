import { cleanParams, http, wrapCall, wrapPage } from "../transport/http";
import type {
  Appointment,
  AppointmentInput,
  AppointmentRequest,
  AppointmentStatus,
  RequestStatus,
} from "../types/appointment.types";

export interface AppointmentListParams {
  day?: string;
  from?: string;
  to?: string;
  status?: AppointmentStatus;
  customerId?: string;
  branchId?: string;
  order?: "asc" | "desc";
  limit?: number;
}

export interface AcceptRequestInput {
  startsAt?: string;
  durationMinutes: number;
  note?: string;
  confirmClash?: boolean;
}

export const appointmentEndpoints = {
  list: (params?: AppointmentListParams) =>
    wrapPage<Appointment>(() => http.get("/appointments", { params: cleanParams(params) })),
  get: (id: string) => wrapCall<Appointment>(() => http.get(`/appointments/${id}`)),
  create: (input: AppointmentInput) => wrapCall<Appointment>(() => http.post("/appointments", input)),
  reschedule: (
    id: string,
    input: { startsAt: string; durationMinutes?: number; reason?: string; confirmClash?: boolean },
  ) => wrapCall<Appointment>(() => http.post(`/appointments/${id}/reschedule`, input)),
  setOutcome: (id: string, status: Exclude<AppointmentStatus, "scheduled">, note?: string) =>
    wrapCall<Appointment>(() => http.post(`/appointments/${id}/status`, { status, note: note || undefined })),
};

export const requestEndpoints = {
  list: (status?: RequestStatus) =>
    wrapPage<AppointmentRequest>(() =>
      http.get("/appointment-requests", { params: cleanParams({ status, limit: 50 }) }),
    ),
  accept: (id: string, input: AcceptRequestInput) =>
    wrapCall<{ request: AppointmentRequest; appointment: Appointment; customerCreated: boolean }>(() =>
      http.post(`/appointment-requests/${id}/accept`, input),
    ),
  decline: (id: string, note?: string) =>
    wrapCall<AppointmentRequest>(() => http.post(`/appointment-requests/${id}/decline`, { note: note || undefined })),
};
