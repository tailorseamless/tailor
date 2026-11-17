import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, optionalText, queryBool, trimmed, uuid } from "../../../shared/utils/zod";
import { INVENTORY_LIMITS, MATERIAL_CATEGORIES, STOCK_KINDS } from "../dto/inventory.dto";

/** A quantity with at most three decimals. */
const quantity = z
  .number()
  .min(0)
  .max(INVENTORY_LIMITS.maxQuantity)
  .transform((value) => Math.round(value * 1000) / 1000);

const unitCost = z
  .number()
  .min(0)
  .max(INVENTORY_LIMITS.maxUnitCost)
  .transform((value) => Math.round(value * 100) / 100);

const materialFields = {
  branchId: z.string().uuid().nullable(),
  name: trimmed(2, 150),
  category: z.enum(MATERIAL_CATEGORIES),
  unit: trimmed(1, 20),
  unitCost: unitCost.nullable(),
  minQuantity: quantity.nullable(),
  supplier: optionalText(150),
  notes: optionalText(1000),
};

export const listMaterialsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    category: z.enum(MATERIAL_CATEGORIES).optional(),
    branchId: z.string().uuid().optional(),
    search: z.string().trim().min(1).max(100).optional(),
    lowStock: queryBool.optional(),
  }),
});

export const materialIdSchema = z.object({ params: idParams("id") });

export const createMaterialSchema = z.object({
  body: z.object({
    ...materialFields,
    branchId: materialFields.branchId.optional(),
    category: materialFields.category.default("other"),
    unitCost: materialFields.unitCost.optional(),
    minQuantity: materialFields.minQuantity.optional(),
    /** Stock already on hand, recorded as the first movement. */
    openingQuantity: quantity.optional(),
  }),
});

export const updateMaterialSchema = z.object({
  params: idParams("id"),
  body: z
    .object(materialFields)
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export const recordMovementSchema = z.object({
  params: idParams("id"),
  body: z
    .object({
      kind: z.enum(STOCK_KINDS),
      /** Purchase / usage: how much moved. Adjustment: the quantity counted. */
      quantity,
      /** Purchases only: the price paid per unit. */
      unitCost: unitCost.optional(),
      /** Usage only: the order the material went into. */
      orderId: uuid.nullable().optional(),
      note: optionalText(500),
    })
    .refine((body) => body.kind === "adjustment" || body.quantity > 0, {
      message: "Enter a quantity greater than zero",
      path: ["quantity"],
    })
    .refine((body) => !body.orderId || body.kind === "usage", {
      message: "Only usage can be linked to an order",
      path: ["orderId"],
    }),
});

export const listMovementsSchema = z.object({
  params: idParams("id"),
  query: z.object({ ...paginationQuery, kind: z.enum(STOCK_KINDS).optional() }),
});

export type ListMaterialsQuery = z.infer<typeof listMaterialsSchema>["query"];
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>["body"];
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>["body"];
export type RecordMovementInput = z.infer<typeof recordMovementSchema>["body"];
export type ListMovementsQuery = z.infer<typeof listMovementsSchema>["query"];
