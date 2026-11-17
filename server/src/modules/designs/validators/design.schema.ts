import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, optionalText, queryBool, trimmed } from "../../../shared/utils/zod";
import { DESIGN_VISIBILITIES } from "../dto/design.dto";

const designFields = {
  name: trimmed(2, 150),
  description: optionalText(2000),
  category: optionalText(60),
  visibility: z.enum(DESIGN_VISIBILITIES),
  isFavourite: z.boolean(),
};

export const listDesignsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    category: z.string().trim().min(1).max(60).optional(),
    visibility: z.enum(DESIGN_VISIBILITIES).optional(),
    favourite: queryBool.optional(),
    search: z.string().trim().min(1).max(100).optional(),
  }),
});

export const designIdSchema = z.object({ params: idParams("id") });
export const designImageSchema = z.object({ params: idParams("id", "imageId") });
export const noInputSchema = z.object({});

export const createDesignSchema = z.object({
  body: z.object({
    ...designFields,
    visibility: designFields.visibility.default("private"),
    isFavourite: designFields.isFavourite.default(false),
  }),
});

export const updateDesignSchema = z.object({
  params: idParams("id"),
  body: z
    .object(designFields)
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export type ListDesignsQuery = z.infer<typeof listDesignsSchema>["query"];
export type CreateDesignInput = z.infer<typeof createDesignSchema>["body"];
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>["body"];
