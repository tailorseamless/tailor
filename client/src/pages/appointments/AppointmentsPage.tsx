import { BranchFilter, useBranchFilter } from "../../components/shared/BranchFilter";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { CalendarDays, ChevronLeft, ChevronRight, MoreVertical, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppointmentForm } from "../../components/appointments/AppointmentForm";
import { RequestsList } from "../../components/appointments/RequestsList";
import { Button } from "../../components/shared/Button";
import { Badge, Card, FilterChips, PageHeader } from "../../components/shared/Display";
import { PromptDialog } from "../../components/shared/Modal";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useAppointmentOutcome, useAppointments, useRequests } from "../../hooks/useAppointments";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Appointment } from "../../types/appointment.types";
import { formatDay, formatTime } from "../../utils/formatDate";
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE } from "../../utils/statusLabels";
import { todayIn } from "../../utils/timezone";

const shiftDay = (day: string, by: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-fg outline-none data-[highlighted]:bg-subtle";

export default function AppointmentsPage() {
  const { can, timeZone } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const today = todayIn(timeZone);
  const day = params.get("day") ?? today;
  const tab = params.get("tab") === "requests" ? "requests" : "diary";
  const [branchId, setBranchId] = useBranchFilter();
  const query = useAppointments({ day, order: "asc", limit: 100, branchId: branchId || undefined });
  const pending = useRequests("pending");
  const outcome = useAppointmentOutcome();
  const [booking, setBooking] = useState(false);
  const [moving, setMoving] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const canWrite = can("appointment.write");
  const pendingCount = pending.data?.meta?.total ?? pending.data?.data.length ?? 0;

  const set = (next: Record<string, string>) =>
    setParams({ ...Object.fromEntries(params), ...next }, { replace: true });

  return (
    <>
      <PageHeader
        title="Diary"
        actions={
          canWrite && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setBooking(true)} data-cy="appt-new">
              Book
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BranchFilter value={branchId} onChange={setBranchId} />
        <FilterChips
          label="View"
          value={tab}
          onChange={(v) => set({ tab: v })}
          options={[
            { value: "diary", label: "Appointments" },
            { value: "requests", label: pendingCount ? `Requests (${pendingCount})` : "Requests" },
          ]}
        />
      </div>

      {tab === "requests" ? (
        <RequestsList />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => set({ day: shiftDay(day, -1) })}
              aria-label="Previous day"
              data-cy="day-prev"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <input
              type="date"
              className="control w-auto"
              value={day}
              onChange={(e) => e.target.value && set({ day: e.target.value })}
              aria-label="Day"
              data-cy="day-picker"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => set({ day: shiftDay(day, 1) })}
              aria-label="Next day"
              data-cy="day-next"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            {day !== today && (
              <Button size="sm" variant="ghost" onClick={() => set({ day: today })} data-cy="day-today">
                Today
              </Button>
            )}
          </div>
          <Card title={day === today ? `Today · ${formatDay(day)}` : formatDay(day)}>
            <QueryState query={query} loadingLabel="Loading the diary">
              {({ data }) =>
                data.length ? (
                  <ul className="divide-y divide-line">
                    {data.map((a) => {
                      const status = APPOINTMENT_STATUS[a.status];
                      return (
                        <li key={a.id} className="flex items-center gap-3 px-4 py-3" data-cy="appt-row">
                          <div className="w-14 shrink-0 text-sm font-semibold text-fg tabular-nums">
                            {formatTime(a.startsAt, timeZone)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/customers/${a.customerId}`}
                              className="truncate text-sm font-medium text-fg hover:underline"
                            >
                              {a.customerName}
                            </Link>
                            <p className="text-xs text-fg-muted">
                              {APPOINTMENT_TYPE[a.type]} · {a.durationMinutes} min
                              {a.orderNumber && ` · ${a.orderNumber}`}
                              {a.customerConfirmedAt && " · Confirmed by customer"}
                            </p>
                            {a.notes && <p className="mt-0.5 text-xs text-fg-subtle">{a.notes}</p>}
                          </div>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {canWrite && a.status === "scheduled" && (
                            <Menu.Root>
                              <Menu.Trigger
                                className="rounded-lg p-1.5 text-fg-muted hover:bg-subtle"
                                aria-label={`Actions for ${a.customerName}`}
                                data-cy="appt-menu"
                              >
                                <MoreVertical className="size-4" aria-hidden />
                              </Menu.Trigger>
                              <Menu.Portal>
                                <Menu.Content
                                  align="end"
                                  className="z-50 min-w-40 rounded-lg border border-line bg-surface p-1 shadow-pop"
                                >
                                  <Menu.Item
                                    className={itemClass}
                                    onSelect={() => outcome.mutate({ id: a.id, status: "completed" })}
                                    data-cy="appt-done"
                                  >
                                    Mark done
                                  </Menu.Item>
                                  <Menu.Item
                                    className={itemClass}
                                    onSelect={() => outcome.mutate({ id: a.id, status: "no_show" })}
                                    data-cy="appt-missed"
                                  >
                                    They didn't come
                                  </Menu.Item>
                                  <Menu.Item className={itemClass} onSelect={() => setMoving(a)} data-cy="appt-move">
                                    Move
                                  </Menu.Item>
                                  <Menu.Item
                                    className={`${itemClass} text-danger-fg`}
                                    onSelect={() => setCancelling(a)}
                                    data-cy="appt-cancel-item"
                                  >
                                    Cancel
                                  </Menu.Item>
                                </Menu.Content>
                              </Menu.Portal>
                            </Menu.Root>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    icon={<CalendarDays className="size-6" aria-hidden />}
                    title="Nothing booked"
                    message={canWrite ? "Book fittings, measurements and collections here." : undefined}
                  />
                )
              }
            </QueryState>
          </Card>
        </>
      )}

      {booking && <AppointmentForm open onClose={() => setBooking(false)} day={day} />}
      {moving && <AppointmentForm open onClose={() => setMoving(null)} appointment={moving} />}
      <PromptDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        onSubmit={(note) =>
          cancelling &&
          outcome.mutate({ id: cancelling.id, status: "cancelled", note }, { onSuccess: () => setCancelling(null) })
        }
        title="Cancel this appointment?"
        label="Reason"
        confirmLabel="Cancel appointment"
        danger
        loading={outcome.isPending}
      />
    </>
  );
}
