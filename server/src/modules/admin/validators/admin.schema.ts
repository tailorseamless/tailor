import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, optionalText, uuid } from "../../../shared/utils/zod";

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

export const setUserStatusSchema = z.object({
  params: idParams("id"),
  body: z.object({ status: z.enum(["active", "disabled"]), reason: optionalText(500) }),
});

export type ListBusinessesQuery = z.infer<typeof listBusinessesSchema>["query"];
export type ListUsersQuery = z.infer<typeof listUsersSchema>["query"];
