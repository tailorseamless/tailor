import { addMoney } from "../../../shared/utils/money";
import { IN_PROGRESS_STATUSES } from "../../orders/domain/orderStatus";
import { ORDER_STATUSES, type OrderStatus } from "../../orders/dto/order.dto";
import type { OrderCounts, OrderStatusRow } from "../dto/dashboard.dto";

/** Turning per-status rows into the dashboard's cards — pure, no I/O. */

const PENDING: readonly OrderStatus[] = ["confirmed", "awaiting_materials"];
const MAKING: readonly OrderStatus[] = ["cutting", "sewing", "fitting", "alterations", "finishing"];

export function summariseOrders(rows: OrderStatusRow[]): OrderCounts {
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
  for (const row of rows) byStatus[row.status] = row.count;

  const sum = (pick: (row: OrderStatusRow) => number, statuses?: readonly OrderStatus[]) =>
    rows.filter((row) => !statuses || statuses.includes(row.status)).reduce((total, row) => total + pick(row), 0);

  return {
    pending: sum((row) => row.count, PENDING),
    inProgress: sum((row) => row.count, MAKING),
    ready: byStatus.ready,
    delivered: byStatus.delivered,
    cancelled: byStatus.cancelled,
    // Same rule as an order's own `isOverdue`: late AND the work is not finished.
    overdue: sum((row) => row.pastDue, IN_PROGRESS_STATUSES),
    createdInPeriod: sum((row) => row.createdInPeriod),
    deliveredInPeriod: sum((row) => row.deliveredInPeriod),
    byStatus,
  };
}

/** The value of orders taken in the period. Cancelled orders are not sales. */
export function orderValueInPeriod(rows: OrderStatusRow[]): number {
  return rows.filter((row) => row.status !== "cancelled").reduce((total, row) => addMoney(total, row.valueInPeriod), 0);
}

/** Defaults to the current month so far. */
export function resolvePeriod(today: string, from?: string, to?: string): { from: string; to: string } {
  const end = to ?? today;
  return { from: from ?? `${end.slice(0, 8)}01`, to: end };
}
