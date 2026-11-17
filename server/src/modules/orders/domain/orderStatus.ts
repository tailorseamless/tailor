import type { OrderStatus } from "../dto/order.dto";

/** The order lifecycle — pure rules, no I/O (Backend Guide §27.3). */

/** Stages while the garment is still with the business. */
export const PRODUCTION_STATUSES: readonly OrderStatus[] = [
  "confirmed",
  "awaiting_materials",
  "cutting",
  "sewing",
  "fitting",
  "alterations",
  "finishing",
  "ready",
];

/** Work has not finished: `ready` is excluded, it only waits for collection. */
export const IN_PROGRESS_STATUSES: readonly OrderStatus[] = PRODUCTION_STATUSES.filter((status) => status !== "ready");

/** Items and prices may still change: nothing has been cut yet. */
const BEFORE_PRODUCTION: readonly OrderStatus[] = ["confirmed", "awaiting_materials"];

export const isInProduction = (status: OrderStatus): boolean => PRODUCTION_STATUSES.includes(status);
export const isClosed = (status: OrderStatus): boolean => status === "delivered" || status === "cancelled";
export const canEditItems = (status: OrderStatus): boolean => BEFORE_PRODUCTION.includes(status);

/**
 * - Between production stages: any move, forwards or back. Real work skips
 *   stages and loops (fitting → alterations → fitting).
 * - `delivered` only from `ready`: a delivered order has completed production (PRD BR-010).
 * - `cancelled` from any production stage.
 * - `delivered` and `cancelled` are final (PRD US-027: no casual moving back).
 */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to || isClosed(from)) return false;
  if (to === "delivered") return from === "ready";
  return true; // production → another production stage, or → cancelled
}

/** Past its due date and the work is not finished. */
export function isOverdue(status: OrderStatus, dueDate: string | null, today: string): boolean {
  return dueDate !== null && dueDate < today && IN_PROGRESS_STATUSES.includes(status);
}

/** "awaiting_materials" → "awaiting materials", for messages. */
/** The moments a customer is emailed about (when the business has order updates on). */
export const CUSTOMER_UPDATE_STATUSES: readonly OrderStatus[] = ["fitting", "ready", "delivered"];
export const tellsCustomer = (status: OrderStatus): boolean => CUSTOMER_UPDATE_STATUSES.includes(status);

export const statusLabel = (status: OrderStatus): string => status.replace(/_/g, " ");
