import { z } from "zod";
import { PAGINATION } from "../../../config/constants";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { email, idParams, optionalText, phone, timeZone, trimmed, uuid } from "../../../shared/utils/zod";
import { ACTOR_KINDS } from "../../activity/dto/activity.dto";
import { MEASUREMENT_UNITS } from "../../businesses/dto/business.dto";
import { currencyCode } from "../../businesses/validators/business.schema";
import { STOP_REASON_MIN } from "../domain/adminRules";
import { ALERT_SEVERITIES, ALERT_STATUSES } from "../dto/alert.dto";
import { ANNOUNCEMENT_AUDIENCES } from "../dto/announcement.dto";
import { ADMIN_REPORTS } from "../dto/insights.dto";

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

/** Making a business's things public for them needs a reason the audit log can show. */
export const switchOnSchema = z.object({
  params: idParams("id"),
  body: z
    .object({
      designs: z.boolean(),
      page: z.boolean(),
      booking: z.boolean(),
      reason: trimmed(STOP_REASON_MIN, 500),
    })
    .refine((body) => body.designs || body.page || body.booking, "Choose what to switch on"),
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

export const activityFeedSchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(30),
      cursor: z.string().trim().max(200).optional(),
      businessId: uuid.optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .refine((q) => !q.from || !q.to || q.from < q.to, { message: "`from` must be before `to`", path: ["from"] }),
});

export const listAlertsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum([...ALERT_STATUSES, "active"]).default("active"),
    severity: z.enum(ALERT_SEVERITIES).optional(),
  }),
});

export const alertIdSchema = z.object({ params: idParams("id") });

export const resolveAlertSchema = z.object({
  params: idParams("id"),
  /** What was done about it (kept on the alert and in the audit log). */
  body: z.object({ note: optionalText(1000) }),
});

export const dailyStatsSchema = z.object({
  query: z.object({ days: z.coerce.number().int().min(7).max(366).default(90) }),
});

export const adoptionSchema = z.object({
  query: z.object({ days: z.coerce.number().int().min(7).max(366).default(30) }),
});

export const cohortsSchema = z.object({
  query: z.object({ weeks: z.coerce.number().int().min(4).max(52).default(12) }),
});

export const adminExportSchema = z.object({
  params: z.object({ kind: z.enum(ADMIN_REPORTS) }),
  query: z.object({
    format: z.enum(["csv", "xlsx"]).default("csv"),
    /** For the reports over a period (admin actions, daily figures, adoption). */
    days: z.coerce.number().int().min(1).max(366).default(90),
  }),
});

export const addNoteSchema = z.object({
  params: idParams("id"),
  body: z.object({ body: trimmed(1, 2000) }),
});

export const churnRiskSchema = z.object({
  query: z.object({
    minScore: z.coerce.number().int().min(0).max(100).default(35),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
});

/** An in-app path only: "/settings", never "//elsewhere" or a full address. */
const appPath = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/(?![/\\])\S*$/, "Use a path inside the app, like /settings");

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: trimmed(3, 120),
    body: trimmed(3, 1000),
    linkPath: appPath.nullable().optional(),
    audience: z.enum(ANNOUNCEMENT_AUDIENCES),
  }),
});

export const announcementIdSchema = z.object({ params: idParams("id") });

export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>["body"];
export type SwitchOnInput = z.infer<typeof switchOnSchema>["body"];
export type ListBusinessesQuery = z.infer<typeof listBusinessesSchema>["query"];
export type ListUsersQuery = z.infer<typeof listUsersSchema>["query"];
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>["query"];
