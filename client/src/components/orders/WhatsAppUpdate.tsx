import { MessageCircle } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { OrderDetail } from "../../types/order.types";
import { formatDay } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { ORDER_STATUS } from "../../utils/statusLabels";
import { whatsappLink } from "../../utils/validation";

/** A ready-written WhatsApp message about where the order is, in the customer's chat. */
export function orderUpdateText(order: OrderDetail, businessName: string): string {
  const first = order.customer?.fullName.split(" ")[0] ?? "there";
  const garments = order.items
    .map((i) => (i.quantity > 1 ? `${i.quantity} ${i.garmentName}` : i.garmentName))
    .join(", ");
  const owing = order.balance > 0 ? ` The balance is ${formatMoney(order.balance, order.currency)}.` : "";
  switch (order.status) {
    case "fitting":
      return `Hello ${first}, your ${garments} (order ${order.orderNumber}) is ready for a fitting at ${businessName}. When can you come in?`;
    case "ready":
      return `Hello ${first}, good news! Your ${garments} (order ${order.orderNumber}) is ready for collection at ${businessName}.${owing}`;
    case "delivered":
      return `Thank you for your order, ${first}! We hope you love your ${garments}.${owing ? ` A reminder:${owing}` : ""} – ${businessName}`;
    case "cancelled":
      return `Hello ${first}, this is ${businessName} about order ${order.orderNumber}.`;
    default:
      return `Hello ${first}, an update from ${businessName}: your ${garments} (order ${order.orderNumber}) is at the ${ORDER_STATUS[order.status].label.toLowerCase()} stage.${
        order.dueDate ? ` We expect it to be ready by ${formatDay(order.dueDate)}.` : ""
      }`;
  }
}

export function WhatsAppUpdate({ order }: { order: OrderDetail }) {
  const { business } = useWorkspace();
  if (!order.customer) return null;
  return (
    <a
      href={whatsappLink(orderUpdateText(order, business.name), order.customer.phone)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-fg hover:bg-subtle"
      data-cy="order-whatsapp"
    >
      <MessageCircle className="size-4" aria-hidden /> Tell customer
    </a>
  );
}
