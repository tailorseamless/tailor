import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, optionalText, phone, trimmed } from "../../../shared/utils/zod";
import { BRANCH_STATUSES } from "../dto/branch.dto";

export const listBranchesSchema = z.object({
  query: z.object({ ...paginationQuery, status: z.enum(BRANCH_STATUSES).optional() }),
});

export const branchIdSchema = z.object({ params: idParams("id") });

export const createBranchSchema = z.object({
  body: z.object({ name: trimmed(2, 120), address: optionalText(500), phone: phone.nullable().optional() }),
});

export const updateBranchSchema = z.object({
  params: idParams("id"),
  body: z
    .object({
      name: trimmed(2, 120),
      address: optionalText(500),
      phone: phone.nullable(),
      /** `archived` keeps it off new work; its history stays. */
      status: z.enum(BRANCH_STATUSES),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

/** `?branchId=` on lists, the dashboard and reports. */
export const branchFilter = { branchId: z.string().uuid().optional() };

export type ListBranchesQuery = z.infer<typeof listBranchesSchema>["query"];
export type CreateBranchInput = z.infer<typeof createBranchSchema>["body"];
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>["body"];
