import { MessageCircle } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { OrderDetail } from "../../types/order.types";
import { orderUpdateText } from "../../utils/orderMessages";
import { whatsappLink } from "../../utils/validation";

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
