import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { email, idParams, optionalText, phone, timeZone, trimmed, uuid } from "../../../shared/utils/zod";
import { MEASUREMENT_UNITS } from "../../businesses/dto/business.dto";
import { currencyCode } from "../../businesses/validators/business.schema";

const search = z.string().trim().min(1).max(100).optional();

export const noInputSchema = z.object({});

export const listBusinessesSchema = z.object({
  query: z.object({ ...paginationQuery, search, status: z.enum(["active", "suspended"]).optional() }),
});

export const listUsersSchema = z.object({
  query: z.object({
    ...paginationQuery,
    search,
    status: z.enum(["active", "disabled"]).optional(),
    businessId: uuid.optional(),
  }),
});

export const adminBusinessIdSchema = z.object({ params: idParams("id") });
export const adminUserIdSchema = z.object({ params: idParams("id") });

export const setBusinessStatusSchema = z.object({
  params: idParams("id"),
  body: z.object({ status: z.enum(["active", "suspended"]), reason: optionalText(500) }),
});

/** A business's details, including the ones its owner can't change: email, currency, time zone. */
export const updateBusinessProfileSchema = z.object({
  params: idParams("id"),
  body: z
    .object({
      name: trimmed(2, 150),
      email: email.nullable(),
      phone: phone.nullable(),
      address: optionalText(500),
      currency: currencyCode,
      timeZone,
      measurementUnit: z.enum(MEASUREMENT_UNITS),
      /** Why (kept in the business's audit log). */
      reason: optionalText(500),
    })
    .partial()
    .refine((body) => Object.keys(body).some((key) => key !== "reason"), "Provide at least one field to update"),
});

export const setUserStatusSchema = z.object({
  params: idParams("id"),
  body: z.object({ status: z.enum(["active", "disabled"]), reason: optionalText(500) }),
});

export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>["body"];
export type ListBusinessesQuery = z.infer<typeof listBusinessesSchema>["query"];
export type ListUsersQuery = z.infer<typeof listUsersSchema>["query"];
