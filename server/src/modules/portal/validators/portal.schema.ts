import { z } from "zod";
import { idParams } from "../../../shared/utils/zod";
import { requestFields } from "../../requests/validators/request.schema";

/** The secret in a portal link: URL-safe, as generated. */
const token = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/, "Link not found");
const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/, "Page not found");

export const portalSchema = z.object({ params: z.object({ token }) });

export const portalReceiptSchema = z.object({ params: z.object({ token }).merge(idParams("paymentId")) });

export const portalConfirmSchema = z.object({ params: z.object({ token }).merge(idParams("appointmentId")) });

/** From the portal the customer is known: only what and when. */
export const portalRequestSchema = z.object({
  params: z.object({ token }),
  body: z.object({
    type: requestFields.type,
    preferredStartsAt: requestFields.preferredStartsAt,
    note: requestFields.note,
  }),
});

export const shopPageSchema = z.object({ params: z.object({ slug }) });

export const bookingRequestSchema = z.object({
  params: z.object({ slug }),
  body: z.object(requestFields),
});

export type PortalRequestInput = z.infer<typeof portalRequestSchema>["body"];
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>["body"];
