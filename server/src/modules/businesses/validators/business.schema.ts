import { z } from "zod";
import { optionalText, phone, trimmed } from "../../../shared/utils/zod";
import { MEASUREMENT_UNITS } from "../dto/business.dto";

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. NGN");

export const getBusinessSchema = z.object({});

/**
 * What the OWNER may change. The business email, currency and time zone are not here on purpose:
 * the email is the one the owner signed up with, and orders and money are recorded in the currency and
 * zone chosen at sign-up. Only a platform admin can change them (PATCH /admin/businesses/:id).
 */
export const updateBusinessSchema = z.object({
  body: z
    .object({
      name: trimmed(2, 150),
      phone: phone.nullable(),
      address: optionalText(500),
      measurementUnit: z.enum(MEASUREMENT_UNITS),
      emailCustomerReminders: z.boolean(),
      emailReceipts: z.boolean(),
      emailOrderUpdates: z.boolean(),
      /** Lower-case letters, digits and dashes: <APP_URL>/book/<slug>. */
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/, "Use 3–60 lower-case letters, digits and dashes")
        .nullable(),
      bookingEnabled: z.boolean(),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>["body"];
