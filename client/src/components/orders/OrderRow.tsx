import { Link } from "react-router-dom";
import type { OrderListItem } from "../../types/order.types";
import { formatDay } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { ORDER_STATUS } from "../../utils/statusLabels";
import { Badge } from "../shared/Display";

/** One order in a list: number, customer, due date, status, balance. */
export function OrderRow({ order }: { order: OrderListItem }) {
  const status = ORDER_STATUS[order.status];
  return (
    <li>
      <Link
        to={`/orders/${order.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
        data-cy="order-row"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">
            {order.customerName} <span className="font-normal text-fg-subtle">· {order.orderNumber}</span>
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {order.dueDate ? (
              <span className={order.isOverdue ? "font-medium text-danger-fg" : undefined}>
                {order.isOverdue ? "Overdue · " : "Due "}
                {formatDay(order.dueDate)}
              </span>
            ) : (
              "No due date"
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          {order.balance > 0 && order.status !== "cancelled" && (
            <span className="text-xs text-warning-fg tabular-nums">
              {formatMoney(order.balance, order.currency)} owed
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
