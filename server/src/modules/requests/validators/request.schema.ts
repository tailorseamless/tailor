import { z } from "zod";
import { PUBLIC } from "../../../config/constants";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { email, idParams, isoDateTime, optionalText, phone, trimmed, uuid } from "../../../shared/utils/zod";
import { APPOINTMENT_LIMITS, APPOINTMENT_TYPES } from "../../appointments/dto/appointment.dto";
import { REQUEST_STATUSES } from "../dto/request.dto";

/** A time in the future, and not absurdly far ahead. */
export const preferredStartsAt = isoDateTime
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() > Date.now(), "Choose a time in the future")
  .refine(
    (date) => date.getTime() < Date.now() + PUBLIC.maxRequestDaysAhead * 86_400_000,
    `Choose a time within the next ${PUBLIC.maxRequestDaysAhead} days`,
  );

/** What someone fills in on the booking page. */
export const requestFields = {
  fullName: trimmed(2, 150),
  phone,
  email: email.nullable().optional(),
  type: z.enum(APPOINTMENT_TYPES),
  preferredStartsAt,
  note: optionalText(1000),
};

export const listRequestsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(REQUEST_STATUSES).optional(),
    customerId: uuid.optional(),
  }),
});

export const requestIdSchema = z.object({ params: idParams("id") });

export const acceptRequestSchema = z.object({
  params: idParams("id"),
  body: z.object({
    /** Defaults to the time asked for. */
    startsAt: isoDateTime.transform((value) => new Date(value)).optional(),
    durationMinutes: z
      .number()
      .int()
      .min(APPOINTMENT_LIMITS.minMinutes)
      .max(APPOINTMENT_LIMITS.maxMinutes)
      .default(APPOINTMENT_LIMITS.defaultMinutes),
    assignedTo: uuid.nullable().optional(),
    branchId: uuid.nullable().optional(),
    /** Shown to the customer in the confirmation email. */
    note: optionalText(500),
    confirmClash: z.boolean().optional(),
  }),
});

export const declineRequestSchema = z.object({
  params: idParams("id"),
  body: z.object({ note: optionalText(500) }),
});

export type ListRequestsQuery = z.infer<typeof listRequestsSchema>["query"];
export type AcceptRequestInput = z.infer<typeof acceptRequestSchema>["body"];
export type DeclineRequestInput = z.infer<typeof declineRequestSchema>["body"];
