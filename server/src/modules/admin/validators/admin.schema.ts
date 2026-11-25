import { z } from "zod";
import { PAGINATION } from "../../../config/constants";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { email, idParams, optionalText, phone, timeZone, trimmed, uuid } from "../../../shared/utils/zod";
import { ACTOR_KINDS } from "../../activity/dto/activity.dto";
import { MEASUREMENT_UNITS } from "../../businesses/dto/business.dto";
import { currencyCode } from "../../businesses/validators/business.schema";
import { STOP_REASON_MIN } from "../domain/adminRules";

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

/** Stopping access (`stop`) needs a reason the audit log can show; restoring it doesn't. */
function statusBody<S extends string, T extends S>(statuses: readonly [S, ...S[]], stop: T) {
  return z
    .object({ status: z.enum(statuses), reason: optionalText(500) })
    .refine((body) => body.status !== stop || (body.reason?.length ?? 0) >= STOP_REASON_MIN, {
      message: `Give a reason of at least ${STOP_REASON_MIN} characters`,
      path: ["reason"],
    });
}

export const setBusinessStatusSchema = z.object({
  params: idParams("id"),
  body: statusBody(["active", "suspended"], "suspended"),
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
  body: statusBody(["active", "disabled"], "disabled"),
});

/** An exact action ("payment.voided") or a whole domain ("payment."). */
const auditAction = z
  .string()
  .trim()
  .regex(/^[a-z_]+\.([a-z_]+)?$/, "An action like payment.voided, or a domain like payment.");

export const listAuditLogsSchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(50),
      cursor: z.string().trim().max(200).optional(),
      businessId: uuid.optional(),
      actorId: uuid.optional(),
      actorKind: z.enum(ACTOR_KINDS).optional(),
      action: auditAction.optional(),
      entityType: z
        .string()
        .trim()
        .regex(/^[a-z_]{1,50}$/)
        .optional(),
      entityId: uuid.optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .refine((q) => !q.from || !q.to || q.from < q.to, { message: "`from` must be before `to`", path: ["from"] }),
});

export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>["body"];
export type ListBusinessesQuery = z.infer<typeof listBusinessesSchema>["query"];
export type ListUsersQuery = z.infer<typeof listUsersSchema>["query"];
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>["query"];
