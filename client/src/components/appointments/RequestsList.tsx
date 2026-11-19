import { Inbox, Palette } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAcceptRequest, useDeclineRequest, useRequests } from "../../hooks/useAppointments";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { AppointmentRequest } from "../../types/appointment.types";
import { errorMessage } from "../../utils/errors";
import { formatDateTime, relative } from "../../utils/formatDate";
import { formatPriceRange } from "../../utils/money";
import { APPOINTMENT_TYPE } from "../../utils/statusLabels";
import { localInputToIso, toLocalInput } from "../../utils/timezone";
import { Button } from "../shared/Button";
import { Photo } from "../public/ShopParts";
import { Badge, Card } from "../shared/Display";
import { Field, FormError, Input, Select } from "../shared/Field";
import { Modal, PromptDialog } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";
import { DURATIONS } from "./AppointmentForm";
import { ClashWarning, clashesIn } from "./ClashWarning";

/** The style a request was made from: tap for the full picture. */
function RequestDesign({ design, currency }: { design: NonNullable<AppointmentRequest["design"]>; currency: string }) {
  const [open, setOpen] = useState(false);
  const price = formatPriceRange(design.priceMin, design.priceMax, currency);
  const detail = [design.category, price].filter(Boolean).join(" · ");
  return (
    <>
      <button
        type="button"
        onClick={() => design.coverUrl && setOpen(true)}
        className="mt-2 flex w-full max-w-sm items-center gap-3 rounded-lg border border-line bg-subtle p-2 text-left hover:border-line-strong"
        data-cy="request-design"
      >
        {design.coverUrl ? (
          <Photo url={design.coverUrl} alt="" width={160} className="size-14 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-md bg-surface text-fg-subtle">
            <Palette className="size-5" aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-xs text-fg-subtle">Asked about this style</span>
          <span className="block truncate text-sm font-medium text-fg">{design.name}</span>
          {detail && <span className="block truncate text-xs text-fg-muted">{detail}</span>}
        </span>
      </button>
      {open && design.coverUrl && (
        <Modal open onClose={() => setOpen(false)} title={design.name} size="lg">
          <Photo
            url={design.coverUrl}
            alt={design.name}
            width={1000}
            className="mx-auto max-h-[70dvh] w-full rounded-lg object-contain"
          />
        </Modal>
      )}
    </>
  );
}

/** Appointments customers asked for from their portal or the booking page. */
export function RequestsList() {
  const { can, timeZone, business } = useWorkspace();
  const query = useRequests("pending");
  const decline = useDeclineRequest();
  const [accepting, setAccepting] = useState<AppointmentRequest | null>(null);
  const [declining, setDeclining] = useState<AppointmentRequest | null>(null);
  const canAct = can("appointment.write");

  return (
    <Card>
      <QueryState query={query}>
        {({ data }) =>
          data.length ? (
            <ul className="divide-y divide-line">
              {data.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                  data-cy="request-row"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {r.fullName} <span className="font-normal text-fg-subtle">· {r.phone}</span>
                    </p>
                    <p className="text-sm text-fg-muted">
                      {APPOINTMENT_TYPE[r.type]} · prefers {formatDateTime(r.preferredStartsAt, timeZone)}
                    </p>
                    {r.note && <p className="mt-1 text-sm text-fg-muted italic">“{r.note}”</p>}
                    {r.design && <RequestDesign design={r.design} currency={business.currency} />}
                    {r.measurements && (
                      <details className="mt-2 text-sm" data-cy="request-measurements">
                        <summary className="cursor-pointer text-fg-muted hover:text-fg">
                          Sent {r.measurements.length} measurement{r.measurements.length === 1 ? "" : "s"} (
                          {r.measurementUnit === "cm" ? "centimetres" : "inches"})
                        </summary>
                        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                          {r.measurements.map((m) => (
                            <div key={m.name} className="flex justify-between gap-3">
                              <dt className="text-fg-muted">{m.name}</dt>
                              <dd className="font-medium text-fg tabular-nums">{m.value}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="mt-1 text-xs text-fg-subtle">
                          Taken by another tailor. Saved on the customer's record when you accept.
                        </p>
                      </details>
                    )}
                    <p className="mt-1 flex items-center gap-2 text-xs text-fg-subtle">
                      <Badge tone={r.source === "portal" ? "brand" : "info"}>
                        {r.source === "portal" ? "Existing customer" : "Booking page"}
                      </Badge>
                      {relative(r.createdAt)}
                    </p>
                  </div>
                  {canAct && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDeclining(r)} data-cy="request-decline">
                        Decline
                      </Button>
                      <Button size="sm" onClick={() => setAccepting(r)} data-cy="request-accept">
                        Accept
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Inbox className="size-6" aria-hidden />}
              title="No requests waiting"
              message="When customers ask for an appointment online, it shows up here."
            />
          )
        }
      </QueryState>
      {accepting && <AcceptModal request={accepting} onClose={() => setAccepting(null)} timeZone={timeZone} />}
      <PromptDialog
        open={declining !== null}
        onClose={() => setDeclining(null)}
        onSubmit={(note) =>
          declining &&
          decline.mutate({ id: declining.id, note: note || undefined }, { onSuccess: () => setDeclining(null) })
        }
        title={`Decline ${declining?.fullName ?? ""}'s request?`}
        message="If they gave an email, we'll let them know."
        label="Message to the customer"
        confirmLabel="Decline"
        danger
        loading={decline.isPending}
      />
    </Card>
  );
}

function AcceptModal({
  request,
  onClose,
  timeZone,
}: {
  request: AppointmentRequest;
  onClose: () => void;
  timeZone: string;
}) {
  const accept = useAcceptRequest();
  const navigate = useNavigate();
  const [startsAt, setStartsAt] = useState(toLocalInput(request.preferredStartsAt, timeZone));
  const [duration, setDuration] = useState(30);
  const clashes = clashesIn(accept.error);

  const save = () =>
    accept.mutate(
      {
        id: request.id,
        startsAt: localInputToIso(startsAt, timeZone),
        durationMinutes: duration,
        confirmClash: Boolean(clashes),
      },
      {
        onSuccess: () => {
          onClose();
          // The request leaves this list once booked, so show where it went: the diary, on that day.
          navigate(`/appointments?day=${startsAt.slice(0, 10)}`);
        },
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Book ${request.fullName}`}
      description={`${APPOINTMENT_TYPE[request.type]} · they asked for ${formatDateTime(request.preferredStartsAt, timeZone)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="accept-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={accept.isPending} data-cy="accept-save">
            {clashes ? "Book anyway" : "Book it"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={accept.error && !clashes ? errorMessage(accept.error) : null} />
        {clashes && <ClashWarning clashes={clashes} />}
        <p className="text-sm text-fg-muted" data-cy="accept-customer-note">
          {request.customerId
            ? `${request.fullName} is already one of your customers.`
            : `${request.fullName} will be saved as a customer, or matched to the one with this phone number if you already have them.`}
        </p>
        {request.measurements && (
          <p className="rounded-lg bg-subtle px-3 py-2 text-sm text-fg-muted" data-cy="accept-measurements-note">
            Their {request.measurements.length} measurement{request.measurements.length === 1 ? "" : "s"} will be saved
            on the customer's record, marked as sent by the customer.
          </p>
        )}
        <Field label="Date and time" hint="Change it if their time doesn't suit you.">
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => {
                setStartsAt(e.target.value);
                accept.reset();
              }}
              data-cy="accept-starts"
            />
          )}
        </Field>
        <Field label="Length">
          {(p) => (
            <Select
              {...p}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              data-cy="accept-duration"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
