import { z } from "zod";
import { optionalText, phone, trimmed } from "../../../shared/utils/zod";
import { isReservedSlug } from "../domain/shopAddress";
import { MEASUREMENT_UNITS } from "../dto/business.dto";

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. NGN");

/**
 * An account number as people write it: "0123 456 789" is stored as "0123456789". Letters are allowed because not
 * every country's account numbers are digits only (IBANs).
 */
const accountNumber = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => /^[A-Za-z0-9]{4,34}$/.test(value), "Use the digits of the account number, 4 to 34 characters");

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
      /** Lower-case letters, digits and dashes: <APP_URL>/<slug>. */
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/, "Use 3–60 lower-case letters, digits and dashes")
        .refine((slug) => !isReservedSlug(slug), "That address is reserved. Try another")
        .nullable(),
      /** Publish the page: designs, price ranges and contact details at the slug. */
      pageEnabled: z.boolean(),
      /** Take appointment requests on the page. */
      bookingEnabled: z.boolean(),
      /** Where customers pay, shown on the public page. All three together, or all null to remove them. */
      bankName: trimmed(2, 100).nullable(),
      accountNumber: accountNumber.nullable(),
      accountName: trimmed(2, 150).nullable(),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>["body"];
