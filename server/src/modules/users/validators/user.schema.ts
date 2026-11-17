import { z } from "zod";
import { phone, timeZone, trimmed } from "../../../shared/utils/zod";
import { currencyCode } from "../../businesses/validators/business.schema";

/** Creating a business workspace. Email and uid come from the Firebase token, never the body. */
export const registerSchema = z.object({
  body: z.object({
    fullName: trimmed(2, 150),
    businessName: trimmed(2, 150),
    phone: phone.optional(),
    currency: currencyCode.optional(),
    timeZone: timeZone.optional(),
  }),
});

export const updateMeSchema = z.object({
  body: z
    .object({
      fullName: trimmed(2, 150),
      phone: phone.nullable(),
      timeZone,
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type UpdateMeInput = z.infer<typeof updateMeSchema>["body"];
