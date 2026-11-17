import { z } from "zod";
import { MEMBER_ROLES } from "../../../config/permissions";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { email, idParams, phone, trimmed, uuid } from "../../../shared/utils/zod";
import { MEMBER_STATUSES } from "../../businesses/dto/business.dto";
import { ASSIGNABLE_ROLES } from "../dto/team.dto";

export const listTeamSchema = z.object({
  query: z.object({
    ...paginationQuery,
    role: z.enum(MEMBER_ROLES).optional(),
    status: z.enum(MEMBER_STATUSES).optional(),
    search: z.string().trim().min(1).max(100).optional(),
  }),
});

export const memberIdSchema = z.object({ params: idParams("userId") });

export const addMemberSchema = z.object({
  body: z.object({
    fullName: trimmed(2, 150),
    /** The address they will sign in with. */
    email,
    phone: phone.nullable().optional(),
    role: z.enum(ASSIGNABLE_ROLES),
    branchId: uuid.nullable().optional(),
  }),
});

export const updateMemberSchema = z.object({
  params: idParams("userId"),
  body: z
    .object({
      fullName: trimmed(2, 150),
      phone: phone.nullable(),
      role: z.enum(ASSIGNABLE_ROLES),
      status: z.enum(MEMBER_STATUSES),
      branchId: uuid.nullable(),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export type ListTeamQuery = z.infer<typeof listTeamSchema>["query"];
export type AddMemberInput = z.infer<typeof addMemberSchema>["body"];
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>["body"];
