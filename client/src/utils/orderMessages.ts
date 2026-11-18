import type { OrderDetail } from "../types/order.types";
import { formatDay } from "./formatDate";
import { formatMoney } from "./money";
import { ORDER_STATUS } from "./statusLabels";

/** A ready-written WhatsApp message about where the order is, in the customer's chat. */
export function orderUpdateText(order: OrderDetail, businessName: string): string {
  const first = order.customer?.fullName.split(" ")[0] ?? "there";
  const garments = order.items
    .map((i) => (i.quantity > 1 ? `${i.quantity} ${i.garmentName}` : i.garmentName))
    .join(", ");
  const money = (amount: number) => formatMoney(amount, order.currency);

  // While a price is still only a quote there is no balance to speak of: say so, with the range.
  const estimate =
    order.pricePending && order.estimateMinTotal !== null && order.estimateMaxTotal !== null
      ? ` The price is still to be confirmed (estimated ${money(order.estimateMinTotal)} – ${money(order.estimateMaxTotal)}).`
      : "";
  // A discount is worth a mention wherever the customer is told what they owe.
  const discount =
    order.discountTotal > 0
      ? ` (your total of ${money(order.totalAmount)} includes a ${money(order.discountTotal)} discount)`
      : "";
  const owing = order.balance > 0 ? ` The balance is ${money(order.balance)}${discount}.` : "";

  switch (order.status) {
    case "fitting":
      return `Hello ${first}, your ${garments} (order ${order.orderNumber}) is ready for a fitting at ${businessName}. When can you come in?${estimate}`;
    case "ready":
      return `Hello ${first}, good news! Your ${garments} (order ${order.orderNumber}) is ready for collection at ${businessName}.${estimate || owing}`;
    case "delivered":
      return `Thank you for your order, ${first}! We hope you love your ${garments}.${owing ? ` A reminder:${owing}` : ""} – ${businessName}`;
    case "cancelled":
      return `Hello ${first}, this is ${businessName} about order ${order.orderNumber}.`;
    default:
      return `Hello ${first}, an update from ${businessName}: your ${garments} (order ${order.orderNumber}) is at the ${ORDER_STATUS[order.status].label.toLowerCase()} stage.${
        order.dueDate ? ` We expect it to be ready by ${formatDay(order.dueDate)}.` : ""
      }${estimate}`;
  }
}
