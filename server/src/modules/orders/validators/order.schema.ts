import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { calendarDate, idParams, optionalText, queryBool, trimmed, uuid } from "../../../shared/utils/zod";
import { FABRIC_SOURCES, ORDER_LIMITS, ORDER_SORTS, ORDER_STATUSES } from "../dto/order.dto";

/** Money as a number with at most two decimals. */
const money = z
  .number()
  .min(0)
  .max(ORDER_LIMITS.maxUnitPrice)
  .transform((value) => Math.round(value * 100) / 100);

const items = z
  .array(
    z.object({
      garmentName: trimmed(1, 150),
      description: optionalText(1000),
      quantity: z.number().int().min(1).max(ORDER_LIMITS.maxQuantity).default(1),
      unitPrice: money,
      fabricSource: z.enum(FABRIC_SOURCES).default("customer"),
      measurementId: uuid.nullable().optional(),
      designId: uuid.nullable().optional(),
    }),
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

export const changeOrderStatusSchema = z.object({
  params: idParams("id"),
  body: z.object({ status: z.enum(ORDER_STATUSES), note: optionalText(500) }),
});

export type ListOrdersQuery = z.infer<typeof listOrdersSchema>["query"];
export type CreateOrderInput = z.infer<typeof createOrderSchema>["body"];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>["body"];
export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>["body"];
