import { CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  blankRequest,
  DesignGallery,
  PublicLayout,
  PublicMessage,
  RequestFieldsForm,
  type RequestFields,
} from "../../components/public/PublicParts";
import { Button } from "../../components/shared/Button";
import { Badge, Card } from "../../components/shared/Display";
import { FormError } from "../../components/shared/Field";
import { FullPageSpinner } from "../../components/shared/States";
import { usePortal, usePortalActions } from "../../hooks/useAccount";
import type { AppointmentType } from "../../types/appointment.types";
import { errorMessage, statusCode } from "../../utils/errors";
import { formatDateTime, formatDay } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { APPOINTMENT_TYPE, ORDER_STATUS } from "../../utils/statusLabels";
import { localInputToIso } from "../../utils/timezone";

const TYPES: AppointmentType[] = ["measurement", "consultation", "fitting", "alteration", "collection"];

/** A customer's private page, opened from the link their tailor sent. */
export default function PortalPage() {
  const { token = "" } = useParams();
  const query = usePortal(token);
  const actions = usePortalActions(token);
  const [request, setRequest] = useState<RequestFields | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (query.isPending) return <FullPageSpinner />;
  if (query.isError) {
    return statusCode(query.error) === 404 ? (
      <PublicMessage title="This link doesn't work any more" message="Ask your tailor to send you a new one." />
    ) : (
      <PublicMessage title="Couldn't open your page" message={errorMessage(query.error)} />
    );
  }

  const p = query.data;
  const tz = p.business.timeZone;
  const money = (n: number) => formatMoney(n, p.business.currency);
  const form = request ?? blankRequest(tz);

  const send = () => {
    setProblem(null);
    const iso = localInputToIso(form.when, tz);
    if (new Date(iso).getTime() < Date.now()) return setProblem("Choose a time in the future.");
    actions.request.mutate(
      { type: form.type, preferredStartsAt: iso, note: form.note.trim() || null },
      { onSuccess: () => setRequest(null) },
    );
  };

  return (
    <PublicLayout business={p.business}>
      <p className="text-lg text-fg">Hello {p.customer.fullName.split(" ")[0]} 👋</p>

      <Card title="Your orders">
        {p.orders.length ? (
          <ul className="divide-y divide-line">
            {p.orders.map((o) => (
              <li key={o.id} className="px-4 py-3" data-cy="portal-order">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-fg">
                    {o.items
                      .map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.garmentName}` : i.garmentName))
                      .join(", ")}
                  </p>
                  <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  {o.orderNumber}
                  {o.dueDate && ` · Due ${formatDay(o.dueDate)}`}
                  {o.pricePending && o.estimateMin !== null && o.estimateMax !== null ? (
                    <>
                      <span data-cy="portal-price-pending">
                        {" "}
                        · Price to be confirmed (estimated {money(o.estimateMin)} – {money(o.estimateMax)})
                      </span>
                      {o.amountPaid > 0 && <span> · {money(o.amountPaid)} paid</span>}
                    </>
                  ) : (
                    <>
                      {" "}
                      · Total {money(o.totalAmount)}
                      {o.discountTotal > 0 && (
                        <span data-cy="portal-discount"> (includes {money(o.discountTotal)} discount)</span>
                      )}
                      {o.balance > 0 && o.status !== "cancelled" && (
                        <span className="font-medium text-warning-fg"> · {money(o.balance)} left to pay</span>
                      )}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-fg-subtle">No orders yet.</p>
        )}
      </Card>

      {p.appointments.length > 0 && (
        <Card title="Your appointments">
          <ul className="divide-y divide-line">
            {p.appointments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{APPOINTMENT_TYPE[a.type]}</p>
                  <p className="text-xs text-fg-muted">{formatDateTime(a.startsAt, tz)}</p>
                </div>
                {a.confirmedAt ? (
                  <span className="inline-flex items-center gap-1 text-sm text-success-fg">
                    <CheckCircle2 className="size-4" aria-hidden /> Confirmed
                  </span>
                ) : (
                  new Date(a.startsAt).getTime() > Date.now() && (
                    <Button
                      size="sm"
                      loading={actions.confirm.isPending && actions.confirm.variables === a.id}
                      onClick={() => actions.confirm.mutate(a.id)}
                      data-cy="portal-confirm"
                    >
                      I'll be there
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Ask for an appointment">
        <div className="space-y-4 p-4">
          <FormError message={problem ?? (actions.request.error ? errorMessage(actions.request.error) : null)} />
          <RequestFieldsForm value={form} onChange={setRequest} types={TYPES} />
          <Button onClick={send} loading={actions.request.isPending} data-cy="portal-request">
            Send request
          </Button>
          {p.requests.length > 0 && (
            <ul className="space-y-1 border-t border-line pt-3 text-sm text-fg-muted">
              {p.requests.map((r) => (
                <li key={r.id}>
                  {APPOINTMENT_TYPE[r.type]} on {formatDateTime(r.preferredStartsAt, tz)} —{" "}
                  <span className="font-medium">{r.status === "pending" ? "waiting for a reply" : r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {p.payments.length > 0 && (
        <Card title="Payments and receipts">
          <ul className="divide-y divide-line">
            {p.payments.map((pay) => (
              <li key={pay.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">
                    {pay.kind === "refund" ? "Refund" : "Payment"} · {money(pay.amount)}
                    {pay.voided && <span className="text-fg-subtle"> (cancelled)</span>}
                  </p>
                  <p className="text-xs text-fg-muted">{formatDateTime(pay.paidAt, tz)}</p>
                </div>
                {pay.receiptNumber && !pay.voided && (
                  <a
                    href={actions.receiptUrl(pay.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-link hover:underline"
                    data-cy="portal-receipt"
                  >
                    <Download className="size-4" aria-hidden /> Receipt
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <DesignGallery designs={p.designs} />
    </PublicLayout>
  );
}
