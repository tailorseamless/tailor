import { z } from "zod";
import { email, optionalText, phone, timeZone, trimmed } from "../../../shared/utils/zod";
import { MEASUREMENT_UNITS } from "../dto/business.dto";

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. NGN");

export const getBusinessSchema = z.object({});

export const updateBusinessSchema = z.object({
  body: z
    .object({
      name: trimmed(2, 150),
      email: email.nullable(),
      phone: phone.nullable(),
      address: optionalText(500),
      currency: currencyCode,
      timeZone,
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
