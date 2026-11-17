import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { calendarDate, idParams, isoDateTime, optionalText, uuid } from "../../../shared/utils/zod";
import {
  APPOINTMENT_LIMITS,
  APPOINTMENT_OUTCOMES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
} from "../dto/appointment.dto";

const instant = isoDateTime.transform((value) => new Date(value));

const durationMinutes = z.number().int().min(APPOINTMENT_LIMITS.minMinutes).max(APPOINTMENT_LIMITS.maxMinutes);

/** Minutes before the start to remind; `null` switches the reminder off. */
const reminderMinutesBefore = z.number().int().min(5).max(APPOINTMENT_LIMITS.maxReminderMinutes).nullable();

/**
 * Save even though the customer or the staff member already has an appointment
 * at that time. Without it an overlap is a 409 that names the clash.
 */
const confirmClash = z.boolean().optional();

export const listAppointmentsSchema = z.object({
  query: z
    .object({
      ...paginationQuery,
      status: z.enum(APPOINTMENT_STATUSES).optional(),
      type: z.enum(APPOINTMENT_TYPES).optional(),
      customerId: uuid.optional(),
      orderId: uuid.optional(),
      branchId: uuid.optional(),
      assignedTo: uuid.optional(),
      /** One calendar day where the caller is — e.g. today's diary. */
      day: calendarDate.optional(),
      from: instant.optional(),
      to: instant.optional(),
      order: z.enum(["asc", "desc"]).default("asc"),
    })
    .refine((query) => !query.from || !query.to || query.from < query.to, {
      message: "Must be after from",
      path: ["to"],
    }),
});

export const appointmentIdSchema = z.object({ params: idParams("id") });

export const createAppointmentSchema = z.object({
  body: z.object({
    customerId: uuid,
    orderId: uuid.nullable().optional(),
    branchId: uuid.nullable().optional(),
    assignedTo: uuid.nullable().optional(),
    type: z.enum(APPOINTMENT_TYPES),
    startsAt: instant,
    durationMinutes: durationMinutes.default(APPOINTMENT_LIMITS.defaultMinutes),
    reminderMinutesBefore: reminderMinutesBefore.default(APPOINTMENT_LIMITS.defaultReminderMinutes),
    notes: optionalText(1000),
    confirmClash,
  }),
});

export const updateAppointmentSchema = z.object({
  params: idParams("id"),
  body: z
    .object({
      orderId: uuid.nullable(),
      branchId: uuid.nullable(),
      assignedTo: uuid.nullable(),
      type: z.enum(APPOINTMENT_TYPES),
      durationMinutes,
      reminderMinutesBefore,
      notes: optionalText(1000),
      confirmClash,
    })
    .partial()
    .refine((body) => Object.keys(body).some((key) => key !== "confirmClash"), "Provide at least one field to update"),
});

export const rescheduleAppointmentSchema = z.object({
  params: idParams("id"),
  body: z.object({
    startsAt: instant.refine((date) => date.getTime() > Date.now(), "Choose a time in the future"),
    durationMinutes: durationMinutes.optional(),
    reason: optionalText(500),
    confirmClash,
  }),
});

export const closeAppointmentSchema = z.object({
  params: idParams("id"),
  body: z.object({ status: z.enum(APPOINTMENT_OUTCOMES), note: optionalText(500) }),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>["query"];
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>["body"];
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>["body"];
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>["body"];
export type CloseAppointmentInput = z.infer<typeof closeAppointmentSchema>["body"];
