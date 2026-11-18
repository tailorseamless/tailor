import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, optionalText, queryBool, trimmed } from "../../../shared/utils/zod";
import { DESIGN_LIMITS, DESIGN_VISIBILITIES } from "../dto/design.dto";

/** A price with at most two decimals. Either end of the range may be left out. */
const price = z
  .number()
  .min(0)
  .max(DESIGN_LIMITS.maxPrice)
  .transform((value) => Math.round(value * 100) / 100)
  .nullable();

const designFields = {
  name: trimmed(2, 150),
  description: optionalText(2000),
  category: optionalText(60),
  priceMin: price,
  priceMax: price,
  visibility: z.enum(DESIGN_VISIBILITIES),
  isFavourite: z.boolean(),
};

/** The one rule that spans two fields. (An update that sends only one end is checked against the stored other end.) */
export const checkPriceRange = (
  body: { priceMin?: number | null; priceMax?: number | null },
  ctx: z.RefinementCtx,
): void => {
  if (body.priceMin != null && body.priceMax != null && body.priceMin > body.priceMax) {
    ctx.addIssue({ code: "custom", path: ["priceMax"], message: "Can't be lower than the lowest price" });
  }
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
  body: z
    .object({
      ...designFields,
      priceMin: designFields.priceMin.optional(),
      priceMax: designFields.priceMax.optional(),
      visibility: designFields.visibility.default("private"),
      isFavourite: designFields.isFavourite.default(false),
    })
    .superRefine(checkPriceRange),
});

export const updateDesignSchema = z.object({
  params: idParams("id"),
  body: z
    .object(designFields)
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update")
    .superRefine(checkPriceRange),
});

export type ListDesignsQuery = z.infer<typeof listDesignsSchema>["query"];
export type CreateDesignInput = z.infer<typeof createDesignSchema>["body"];
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>["body"];
