import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { email, idParams, optionalText, phone, trimmed } from "../../../shared/utils/zod";
import { CUSTOMER_GENDERS, CUSTOMER_SORTS } from "../dto/customer.dto";

const customerFields = {
  fullName: trimmed(2, 150),
  phone,
  email: email.nullable().optional(),
  address: optionalText(500),
  gender: z.enum(CUSTOMER_GENDERS).nullable().optional(),
  notes: optionalText(2000),
};

/**
 * Save even though another customer has this phone number (families share
 * phones). Without it a duplicate number is a 409 (PRD US-007).
 */
const confirmDuplicate = z.boolean().optional();

export const listCustomersSchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(CUSTOMER_SORTS).default("recent"),
  }),
});

export const customerIdSchema = z.object({ params: idParams("id") });

export const createCustomerSchema = z.object({
  body: z.object({ ...customerFields, confirmDuplicate }),
});

export const updateCustomerSchema = z.object({
  params: idParams("id"),
  body: z
    .object({ ...customerFields, confirmDuplicate })
    .partial()
    .refine(
      (body) => Object.keys(body).some((key) => key !== "confirmDuplicate"),
      "Provide at least one field to update",
    ),
});

export type ListCustomersQuery = z.infer<typeof listCustomersSchema>["query"];
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>["body"];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];
