import * as Menu from "@radix-ui/react-dropdown-menu";
import { Download, Mail, MoreVertical, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { useOrderPayments, useReceipt, useVoidPayment } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { OrderDetail } from "../../types/order.types";
import type { Payment } from "../../types/payment.types";
import { cn } from "../../utils/cn";
import { formatDateTime } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { PAYMENT_METHOD } from "../../utils/statusLabels";
import { Button } from "../shared/Button";
import { Badge, Card } from "../shared/Display";
import { PromptDialog } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";
import { PaymentModal } from "./PaymentModal";

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-fg outline-none data-[highlighted]:bg-subtle";

export function PaymentsCard({ order }: { order: OrderDetail }) {
  const { can, timeZone } = useWorkspace();
  const query = useOrderPayments(order.id);
  const receipt = useReceipt();
  const voidPayment = useVoidPayment(order.id);
  const [modal, setModal] = useState<"payment" | "refund" | null>(null);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const money = (n: number) => formatMoney(n, order.currency);
  const closed = order.status === "cancelled";
  // While an item has only an estimate the total is not final: a deposit may go up to the top of the estimate.
  const pending = order.pricePending && order.estimateMaxTotal !== null;
  const room = pending ? Math.max(Math.round(((order.estimateMaxTotal ?? 0) - order.amountPaid) * 100) / 100, 0) : 0;

  return (
    <Card
      title="Payments"
      action={
        <div className="flex gap-1">
          {can("payment.refund") && order.amountPaid > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Undo2 className="size-4" aria-hidden />}
              onClick={() => setModal("refund")}
              data-cy="order-refund"
            >
              Refund
            </Button>
          )}
          {can("payment.record") && !closed && (
            <Button
              size="sm"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setModal("payment")}
              data-cy="order-record-payment"
            >
              Payment
            </Button>
          )}
        </div>
      }
    >
      <dl className="grid grid-cols-3 gap-2 border-b border-line px-4 py-3 text-center">
        <div>
          <dt className="text-xs text-fg-subtle">Total</dt>
          {pending ? (
            <dd className="text-sm font-semibold text-warning-fg" data-cy="order-total-pending">
              To be agreed
            </dd>
          ) : (
            <dd className="font-semibold text-fg tabular-nums">{money(order.totalAmount)}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Paid</dt>
          <dd className="font-semibold text-success-fg tabular-nums">{money(order.amountPaid)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Balance</dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              pending ? "text-sm text-fg-muted" : order.balance > 0 ? "text-warning-fg" : "text-fg",
            )}
            data-cy="order-balance"
          >
            {pending ? "To be agreed" : money(order.balance)}
          </dd>
        </div>
      </dl>
      <QueryState query={query}>
        {({ data }) =>
          data.length ? (
            <ul className="divide-y divide-line">
              {data.map((p) => (
                <li key={p.id} className={cn("flex items-center gap-3 px-4 py-3", p.voided && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {p.kind === "refund" ? "Refund" : p.kind === "void" ? "Void" : PAYMENT_METHOD[p.method]}
                      {p.receiptNumber && <span className="font-normal text-fg-subtle"> · {p.receiptNumber}</span>}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {formatDateTime(p.paidAt, timeZone)}
                      {p.reference && ` · Ref ${p.reference}`}
                    </p>
                  </div>
                  {p.voided && <Badge>Voided</Badge>}
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      p.kind === "payment" ? "font-medium text-fg" : "text-danger-fg",
                      p.voided && "line-through",
                    )}
                  >
                    {p.kind === "payment" ? "" : "−"}
                    {money(p.amount)}
                  </span>
                  {p.kind !== "void" && (
                    <Menu.Root>
                      <Menu.Trigger
                        className="rounded-lg p-1.5 text-fg-muted hover:bg-subtle"
                        aria-label="Payment actions"
                        data-cy="payment-menu"
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </Menu.Trigger>
                      <Menu.Portal>
                        <Menu.Content
                          align="end"
                          className="z-50 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-pop"
                        >
                          {p.receiptNumber && (
                            <Menu.Item
                              className={itemClass}
                              onSelect={() => receipt.download.mutate(p.id)}
                              data-cy="receipt-pdf"
                            >
                              <Download className="size-4" aria-hidden /> Receipt PDF
                            </Menu.Item>
                          )}
                          {p.receiptNumber && (
                            <Menu.Item
                              className={itemClass}
                              onSelect={() => receipt.email.mutate({ id: p.id })}
                              data-cy="receipt-email"
                            >
                              <Mail className="size-4" aria-hidden /> Email receipt
                            </Menu.Item>
                          )}
                          {can("payment.void") && !p.voided && (
                            <Menu.Item
                              className={cn(itemClass, "text-danger-fg")}
                              onSelect={() => setVoiding(p)}
                              data-cy="payment-void"
                            >
                              <Undo2 className="size-4" aria-hidden /> Void (entered by mistake)
                            </Menu.Item>
                          )}
                        </Menu.Content>
                      </Menu.Portal>
                    </Menu.Root>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No payments yet"
              message={
                pending
                  ? `Record a deposit when the customer pays (up to ${money(room)} until the final price is agreed).`
                  : order.balance > 0
                    ? "Record a deposit when the customer pays."
                    : undefined
              }
            />
          )
        }
      </QueryState>
      {modal && (
        <PaymentModal
          open
          onClose={() => setModal(null)}
          orderId={order.id}
          kind={modal}
          suggested={modal === "payment" && !pending ? Math.max(order.balance, 0) : 0}
          max={modal === "payment" ? (pending ? room : order.balance) : order.amountPaid}
          limitLabel={pending ? "left under the estimate" : "balance"}
        />
      )}
      <PromptDialog
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        onSubmit={(reason) =>
          voiding && voidPayment.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })
        }
        title="Void this payment?"
        message={
          voiding
            ? `${money(voiding.amount)} will no longer count towards the order. Use a refund instead if money went back to the customer.`
            : undefined
        }
        label="Reason"
        required
        danger
        confirmLabel="Void payment"
        loading={voidPayment.isPending}
      />
    </Card>
  );
}
