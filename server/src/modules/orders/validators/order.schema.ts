import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { calendarDate, idParams, optionalText, queryBool, trimmed, uuid } from "../../../shared/utils/zod";
import { DISCOUNT_TYPES, type DiscountType } from "../domain/orderMoney";
import { FABRIC_SOURCES, ORDER_LIMITS, ORDER_SORTS, ORDER_STATUSES } from "../dto/order.dto";

/** Money as a number with at most two decimals. */
const money = z
  .number()
  .min(0)
  .max(ORDER_LIMITS.maxUnitPrice)
  .transform((value) => Math.round(value * 100) / 100);

/** A discount is a type and a value together; a value of 0 (or no value) means no discount. */
const discountFields = {
  discountType: z.enum(DISCOUNT_TYPES).nullable().optional(),
  discountValue: z
    .number()
    .min(0)
    .max(ORDER_LIMITS.maxUnitPrice)
    .transform((value) => Math.round(value * 100) / 100)
    .nullable()
    .optional(),
};

/** The checks every discount must pass. `gross` is quantity × price when the price is agreed, else unknown. */
function checkDiscount(
  item: { discountType?: DiscountType | null; discountValue?: number | null },
  gross: number | null,
  ctx: z.RefinementCtx,
): void {
  const value = item.discountValue ?? 0;
  if (value <= 0) return;
  if (!item.discountType) {
    ctx.addIssue({ code: "custom", path: ["discountType"], message: "Choose an amount or a percentage" });
  } else if (item.discountType === "percent" && value > 100) {
    ctx.addIssue({ code: "custom", path: ["discountValue"], message: "A percentage can't be more than 100" });
  } else if (item.discountType === "amount" && gross !== null && gross > 0 && value > gross) {
    ctx.addIssue({ code: "custom", path: ["discountValue"], message: "The discount can't be more than the price" });
  }
}

/** No discount, whatever was sent with it, when the value is 0 or missing. */
const normaliseDiscount = <T extends { discountType?: DiscountType | null; discountValue?: number | null }>(
  item: T,
) => {
  const has = Boolean(item.discountType) && (item.discountValue ?? 0) > 0;
  return {
    ...item,
    discountType: has ? (item.discountType as DiscountType) : null,
    discountValue: has ? (item.discountValue as number) : null,
  };
};

const items = z
  .array(
    z
      .object({
        garmentName: trimmed(1, 150),
        description: optionalText(1000),
        quantity: z.number().int().min(1).max(ORDER_LIMITS.maxQuantity).default(1),
        /** The agreed price of one piece. Leave it 0 while only an estimate is known. */
        unitPrice: money,
        estimateMin: money.nullable().optional(),
        estimateMax: money.nullable().optional(),
        ...discountFields,
        fabricSource: z.enum(FABRIC_SOURCES).default("customer"),
        measurementId: uuid.nullable().optional(),
        designId: uuid.nullable().optional(),
      })
      .superRefine((item, ctx) => {
        const min = item.estimateMin ?? null;
        const max = item.estimateMax ?? null;
        if ((min === null) !== (max === null)) {
          ctx.addIssue({
            code: "custom",
            path: [min === null ? "estimateMin" : "estimateMax"],
            message: "Give both ends of the range",
          });
        } else if (min !== null && max !== null && min > max) {
          ctx.addIssue({
            code: "custom",
            path: ["estimateMax"],
            message: "Can't be lower than the start of the range",
          });
        }
        checkDiscount(item, item.unitPrice > 0 ? item.quantity * item.unitPrice : null, ctx);
      })
      .transform((item) => ({
        ...normaliseDiscount(item),
        estimateMin: item.estimateMin ?? null,
        estimateMax: item.estimateMax ?? null,
      })),
  )
  .min(1, "Add at least one garment")
  .max(ORDER_LIMITS.maxItems);

export const listOrdersSchema = z.object({
  query: z
    .object({
      ...paginationQuery,
      status: z.enum(ORDER_STATUSES).optional(),
      customerId: uuid.optional(),
      branchId: uuid.optional(),
      search: z.string().trim().min(1).max(100).optional(),
      dueFrom: calendarDate.optional(),
      dueTo: calendarDate.optional(),
      overdue: queryBool.optional(),
      unfinished: queryBool.optional(),
      unpaid: queryBool.optional(),
      sort: z.enum(ORDER_SORTS).default("recent"),
    })
    .refine((query) => !query.dueFrom || !query.dueTo || query.dueFrom <= query.dueTo, {
      message: "Must not be before dueFrom",
      path: ["dueTo"],
    }),
});

export const orderIdSchema = z.object({ params: idParams("id") });

export const orderImageSchema = z.object({ params: idParams("id", "imageId") });

export const createOrderSchema = z.object({
  body: z.object({
    customerId: uuid,
    /** Defaults to the home branch of whoever takes the order. */
    branchId: uuid.nullable().optional(),
    dueDate: calendarDate.nullable().optional(),
    notes: optionalText(2000),
    items,
  }),
});

export const updateOrderSchema = z.object({
  params: idParams("id"),
  body: z
    .object({ dueDate: calendarDate.nullable(), notes: optionalText(2000), branchId: uuid.nullable(), items })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

/** Agreeing (or adjusting) the price and discount of items already on the order. Anything left out stays as it is. */
export const setPricesSchema = z.object({
  params: idParams("id"),
  body: z.object({
    items: z
      .array(
        z
          .object({ id: uuid, unitPrice: money, ...discountFields })
          // The line's size is only known once the item is loaded, so the amount cap is checked in the service.
          .superRefine((item, ctx) => checkDiscount(item, null, ctx))
          .transform(normaliseDiscount),
      )
      .min(1, "Give at least one price")
      .max(ORDER_LIMITS.maxItems),
  }),
});

export const changeOrderStatusSchema = z.object({
  params: idParams("id"),
  body: z.object({ status: z.enum(ORDER_STATUSES), note: optionalText(500) }),
});

export type ListOrdersQuery = z.infer<typeof listOrdersSchema>["query"];
export type CreateOrderInput = z.infer<typeof createOrderSchema>["body"];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>["body"];
export type SetPricesInput = z.infer<typeof setPricesSchema>["body"];
export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>["body"];
