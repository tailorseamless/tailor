import {
  appointmentEndpoints,
  requestEndpoints,
  type AcceptRequestInput,
  type AppointmentListParams,
} from "../endpoints/appointment.endpoints";
import type { AppointmentInput, AppointmentStatus, RequestStatus } from "../types/appointment.types";
import { keys } from "./queryKeys";
import { useApiMutation, usePaginatedQuery } from "./useApi";

const changed = [keys.appointments.all, ["dashboard"]];

export function useAppointments(params: AppointmentListParams) {
  return usePaginatedQuery(keys.appointments.list(params), () => appointmentEndpoints.list(params));
}

/** Clash warnings (409) are shown by the form, so errors aren't toasted. */
export function useCreateAppointment() {
  return useApiMutation((input: AppointmentInput) => appointmentEndpoints.create(input), {
    invalidate: changed,
    success: "Appointment booked",
    toastError: false,
  });
}

export function useReschedule() {
  return useApiMutation(
    (vars: { id: string; startsAt: string; durationMinutes?: number; reason?: string; confirmClash?: boolean }) => {
      const { id, ...input } = vars;
      return appointmentEndpoints.reschedule(id, input);
    },
    { invalidate: changed, success: "Appointment moved", toastError: false },
  );
}

export function useAppointmentOutcome() {
  return useApiMutation(
    (vars: { id: string; status: Exclude<AppointmentStatus, "scheduled">; note?: string }) =>
      appointmentEndpoints.setOutcome(vars.id, vars.status, vars.note),
    { invalidate: changed, success: "Appointment updated" },
  );
}

export function useRequests(status?: RequestStatus) {
  return usePaginatedQuery(keys.requests.list(status), () => requestEndpoints.list(status));
}

export function useAcceptRequest() {
  return useApiMutation(
    (vars: { id: string } & AcceptRequestInput) => {
      const { id, ...input } = vars;
      return requestEndpoints.accept(id, input);
    },
    {
      invalidate: [keys.requests.all, ...changed, keys.customers.all],
      success: ({ appointment, customerCreated }) =>
        customerCreated
          ? `Booked, and ${appointment.customerName} is saved as a new customer`
          : "Booked, and the customer is told",
      toastError: false,
    },
  );
}

export function useDeclineRequest() {
  return useApiMutation((vars: { id: string; note?: string }) => requestEndpoints.decline(vars.id, vars.note), {
    invalidate: [keys.requests.all],
    success: "Request declined",
  });
}
