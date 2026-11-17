import { useState } from "react";
import { useCreateAppointment, useReschedule } from "../../hooks/useAppointments";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Appointment, AppointmentType } from "../../types/appointment.types";
import { errorMessage } from "../../utils/errors";
import { APPOINTMENT_TYPE } from "../../utils/statusLabels";
import { localInputToIso, toLocalInput } from "../../utils/timezone";
import { Button } from "../shared/Button";
import { CustomerSelect, type PickedCustomer } from "../shared/CustomerSelect";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { ClashWarning, clashesIn } from "./ClashWarning";

export const DURATIONS = [15, 30, 45, 60, 90, 120];
const REMINDERS = [
  { value: "", label: "No reminder" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "180", label: "3 hours before" },
  { value: "1440", label: "1 day before" },
];

/** The next half hour, as a starting suggestion. */
function nextSlot(day: string | undefined, timeZone: string): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  const local = toLocalInput(now, timeZone);
  return day && day > local.slice(0, 10) ? `${day}T10:00` : local;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Given: move this appointment. Not given: book a new one. */
  appointment?: Appointment;
  day?: string;
}

export function AppointmentForm({ open, onClose, appointment, day }: Props) {
  const { timeZone } = useWorkspace();
  const create = useCreateAppointment();
  const reschedule = useReschedule();
  const mutation = appointment ? reschedule : create;
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [type, setType] = useState<AppointmentType>("measurement");
  const [startsAt, setStartsAt] = useState(
    appointment ? toLocalInput(appointment.startsAt, timeZone) : nextSlot(day, timeZone),
  );
  const [duration, setDuration] = useState(appointment?.durationMinutes ?? 30);
  const [reminder, setReminder] = useState("60");
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const clashes = clashesIn(mutation.error);

  const close = () => {
    mutation.reset();
    onClose();
  };

  const save = (confirmClash = false) => {
    setProblem(null);
    if (!appointment && !customer) return setProblem("Choose a customer.");
    if (!startsAt) return setProblem("Choose a date and time.");
    const iso = localInputToIso(startsAt, timeZone);
    if (new Date(iso).getTime() < Date.now()) return setProblem("Choose a time in the future.");
    if (appointment) {
      reschedule.mutate(
        {
          id: appointment.id,
          startsAt: iso,
          durationMinutes: duration,
          reason: notes.trim() || undefined,
          confirmClash,
        },
        { onSuccess: close },
      );
    } else if (customer) {
      create.mutate(
        {
          customerId: customer.id,
          type,
          startsAt: iso,
          durationMinutes: duration,
          reminderMinutesBefore: reminder ? Number(reminder) : null,
          notes: notes.trim() || null,
          confirmClash,
        },
        { onSuccess: close },
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={appointment ? `Move ${appointment.customerName}'s appointment` : "Book an appointment"}
      footer={
        <>
          <Button variant="secondary" onClick={close} data-cy="appt-cancel">
            Cancel
          </Button>
          <Button onClick={() => save(Boolean(clashes))} loading={mutation.isPending} data-cy="appt-save">
            {clashes ? "Book anyway" : appointment ? "Move" : "Book"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error && !clashes ? errorMessage(mutation.error) : null)} />
        {clashes && <ClashWarning clashes={clashes} />}
        {!appointment && (
          <>
            <CustomerSelect value={customer} onChange={setCustomer} />
            <Field label="What for">
              {(p) => (
                <Select
                  {...p}
                  value={type}
                  onChange={(e) => setType(e.target.value as AppointmentType)}
                  data-cy="appt-type"
                >
                  {(Object.keys(APPOINTMENT_TYPE) as AppointmentType[]).map((t) => (
                    <option key={t} value={t}>
                      {APPOINTMENT_TYPE[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date and time">
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  mutation.reset();
                }}
                data-cy="appt-starts"
              />
            )}
          </Field>
          <Field label="Length">
            {(p) => (
              <Select
                {...p}
                value={duration}
                onChange={(e) => {
                  setDuration(Number(e.target.value));
                  mutation.reset();
                }}
                data-cy="appt-duration"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} minutes` : `${d / 60} hour${d > 60 ? "s" : ""}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {!appointment && (
          <Field label="Remind me">
            {(p) => (
              <Select {...p} value={reminder} onChange={(e) => setReminder(e.target.value)} data-cy="appt-reminder">
                {REMINDERS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={appointment ? "Reason (optional)" : "Notes (optional)"}>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              data-cy="appt-notes"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
