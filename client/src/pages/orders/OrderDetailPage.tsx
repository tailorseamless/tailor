import { CalendarClock, Pencil, Tag } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ItemPriceLine } from "../../components/orders/ItemPriceLine";
import { PaymentsCard } from "../../components/orders/PaymentsCard";
import { PricesModal } from "../../components/orders/PricesModal";
import { ItemDesign } from "../../components/orders/ItemDesign";
import { WhatsAppUpdate } from "../../components/orders/WhatsAppUpdate";
import { OrderTasksCard } from "../../components/orders/OrderTasksCard";
import { PicturesCard } from "../../components/orders/PicturesCard";
import { StatusModal } from "../../components/orders/StatusModal";
import { Button } from "../../components/shared/Button";
import { Badge, Card, Detail, PageHeader } from "../../components/shared/Display";
import { DatePicker } from "../../components/shared/DatePicker";
import { Field, Textarea } from "../../components/shared/Field";
import { Modal } from "../../components/shared/Modal";
import { QueryState } from "../../components/shared/States";
import { useOrder, useUpdateOrder } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { OrderDetail } from "../../types/order.types";
import { formatDate, formatDateTime, formatDay } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { nextStatuses, ORDER_STATUS } from "../../utils/statusLabels";

export default function OrderDetailPage() {
  const { id = "" } = useParams();
  const { can, timeZone } = useWorkspace();
  const query = useOrder(id);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pricing, setPricing] = useState(false);

  return (
    <QueryState query={query} loadingLabel="Loading order">
      {(o) => {
        const status = ORDER_STATUS[o.status];
        const canMove = can("order.status") && nextStatuses(o.status).length > 0;
        const open = o.status !== "delivered" && o.status !== "cancelled";
        const money = (n: number) => formatMoney(n, o.currency);
        return (
          <>
            <PageHeader
              back={{ to: "/orders", label: "Orders" }}
              title={`Order ${o.orderNumber}`}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {o.isOverdue && <Badge tone="danger">Overdue</Badge>}
                  {o.customer && (
                    <Link to={`/customers/${o.customer.id}`} className="text-link hover:underline">
                      {o.customer.fullName}
                    </Link>
                  )}
                </span>
              }
              actions={
                <>
                  <WhatsAppUpdate order={o} />
                  {can("order.update") && open && (
                    <Button
                      variant="secondary"
                      icon={<Tag className="size-4" aria-hidden />}
                      onClick={() => setPricing(true)}
                      data-cy="order-prices"
                    >
                      {o.pricePending ? "Set final price" : "Prices"}
                    </Button>
                  )}
                  {can("order.update") && open && (
                    <Button
                      variant="secondary"
                      icon={<Pencil className="size-4" aria-hidden />}
                      onClick={() => setEditing(true)}
                      data-cy="order-edit"
                    >
                      Edit
                    </Button>
                  )}
                  {canMove && (
                    <Button onClick={() => setStatusOpen(true)} data-cy="order-change-status">
                      Update status
                    </Button>
                  )}
                </>
              }
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                {o.pricePending && o.estimateMinTotal !== null && o.estimateMaxTotal !== null && (
                  <div
                    className="rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-fg"
                    role="status"
                    data-cy="order-price-pending"
                  >
                    <p className="font-medium">The final price isn&apos;t agreed yet.</p>
                    <p>
                      Estimated total {money(o.estimateMinTotal)} – {money(o.estimateMaxTotal)}. Deposits can go up to{" "}
                      {money(o.estimateMaxTotal)}.
                    </p>
                  </div>
                )}
                <Card title="Items">
                  <ul className="divide-y divide-line">
                    {o.items.map((item) => (
                      <li key={item.id} className="flex gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">
                            {item.quantity > 1 && `${item.quantity} × `}
                            {item.garmentName}
                          </p>
                          <p className="text-xs text-fg-muted">
                            {item.fabricSource === "customer" ? "Customer's fabric" : "Our fabric"}
                            {item.measurementId ? " · Measurements attached" : ""}
                          </p>
                          {item.description && (
                            <p className="mt-1 text-sm whitespace-pre-line text-fg-muted">{item.description}</p>
                          )}
                          {item.designId && <ItemDesign id={item.designId} />}
                        </div>
                        <ItemPriceLine item={item} currency={o.currency} />
                      </li>
                    ))}
                  </ul>
                  {o.discountTotal > 0 && (
                    <p className="flex justify-between border-t border-line px-4 py-3 text-sm text-fg-muted">
                      <span>Discounts given</span>
                      <span className="tabular-nums" data-cy="order-discount-total">
                        −{money(o.discountTotal)}
                      </span>
                    </p>
                  )}
                </Card>
                {can("payment.read") && <PaymentsCard order={o} />}
                <OrderTasksCard orderId={o.id} closed={o.status === "delivered" || o.status === "cancelled"} />
                <PicturesCard orderId={o.id} images={o.images} />
              </div>
              <div className="space-y-5">
                <Card title="Details">
                  <dl className="space-y-3 px-4 py-3">
                    <Detail label="Due">{o.dueDate && formatDay(o.dueDate)}</Detail>
                    <Detail label="Taken in">{formatDate(o.createdAt, timeZone)}</Detail>
                    {o.deliveredAt && <Detail label="Delivered">{formatDateTime(o.deliveredAt, timeZone)}</Detail>}
                    <Detail label="Customer phone">
                      {o.customer && (
                        <a href={`tel:${o.customer.phone}`} className="text-link">
                          {o.customer.phone}
                        </a>
                      )}
                    </Detail>
                    <Detail label="Notes">{o.notes && <span className="whitespace-pre-line">{o.notes}</span>}</Detail>
                  </dl>
                </Card>
                <Card title="History">
                  <ol className="space-y-3 px-4 py-3">
                    {o.history.map((event) => (
                      <li key={event.id} className="flex gap-3">
                        <CalendarClock className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
                        <div>
                          <p className="text-sm text-fg">{ORDER_STATUS[event.toStatus].label}</p>
                          <p className="text-xs text-fg-subtle">{formatDateTime(event.createdAt, timeZone)}</p>
                          {event.note && <p className="mt-0.5 text-sm text-fg-muted">{event.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              </div>
            </div>
            <StatusModal open={statusOpen} onClose={() => setStatusOpen(false)} orderId={o.id} current={o.status} />
            {editing && <EditOrderModal order={o} onClose={() => setEditing(false)} />}
            {pricing && <PricesModal order={o} onClose={() => setPricing(false)} />}
          </>
        );
      }}
    </QueryState>
  );
}

function EditOrderModal({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const { timeZone } = useWorkspace();
  const update = useUpdateOrder(order.id);
  const [dueDate, setDueDate] = useState(order.dueDate ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit order"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="order-edit-cancel">
            Cancel
          </Button>
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate({ dueDate: dueDate || null, notes: notes.trim() || null }, { onSuccess: onClose })
            }
            data-cy="order-edit-save"
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Due date">
          {(p) => (
            <DatePicker {...p} value={dueDate} onChange={setDueDate} timeZone={timeZone} data-cy="order-edit-due" />
          )}
        </Field>
        <Field label="Notes">
          {(p) => (
            <Textarea
              {...p}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              data-cy="order-edit-notes"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
