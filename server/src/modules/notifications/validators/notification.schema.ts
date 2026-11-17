import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, queryBool } from "../../../shared/utils/zod";
import { EMAIL_STATUSES } from "../dto/email.dto";
import { NOTIFICATION_TYPES } from "../dto/notification.dto";

export const listNotificationsSchema = z.object({
  query: z.object({ ...paginationQuery, unreadOnly: queryBool.optional() }),
});

export const notificationIdSchema = z.object({ params: idParams("id") });

export const noInputSchema = z.object({});

export const listOutboxSchema = z.object({
  query: z.object({ ...paginationQuery, status: z.enum(EMAIL_STATUSES).optional() }),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    preferences: z
      .array(z.object({ type: z.enum(NOTIFICATION_TYPES), inApp: z.boolean(), email: z.boolean(), push: z.boolean() }))
      .min(1)
      .max(NOTIFICATION_TYPES.length)
      .refine(
        (items) => new Set(items.map((item) => item.type)).size === items.length,
        "Each type can only appear once",
      ),
  }),
});

/** An FCM registration token (long, URL-safe-ish). */
export const deviceSchema = z.object({
  body: z.object({
    token: z
      .string()
      .trim()
      .min(20)
      .max(512)
      .regex(/^[\w:.-]+$/, "Not a push token"),
  }),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>["query"];
