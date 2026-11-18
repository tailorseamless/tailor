import { MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import type { AppointmentType } from "../../types/appointment.types";
import type { PublicBusiness, PublicDesign } from "../../types/portal.types";
import { APPOINTMENT_TYPE } from "../../utils/statusLabels";
import { toLocalInput } from "../../utils/timezone";
import { Card } from "../shared/Display";
import { Field, Input, Select, Textarea } from "../shared/Field";

/** The business's header for pages customers see without signing in. */
export function PublicLayout({ business, children }: { business: PublicBusiness; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="font-display text-2xl font-semibold text-fg">{business.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="inline-flex items-center gap-1 hover:text-fg"
                data-cy="public-phone"
              >
                <Phone className="size-4" aria-hidden /> {business.phone}
              </a>
            )}
            {business.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden /> {business.address}
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">{children}</main>
      <footer className="pb-8 text-center text-xs text-fg-subtle">Powered by Tailor Seamless</footer>
    </div>
  );
}

export function DesignGallery({ designs }: { designs: PublicDesign[] }) {
  const shown = designs.filter((d) => d.images.length);
  if (!shown.length) return null;
  return (
    <Card title="Styles we make">
      <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
        {shown.map((d) => (
          <li key={d.id}>
            <img
              src={d.images[0].url}
              alt={d.name}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-lg bg-subtle object-cover"
            />
            <p className="mt-1 text-sm font-medium text-fg">{d.name}</p>
            {d.category && <p className="text-xs text-fg-subtle">{d.category}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export interface RequestFields {
  type: AppointmentType;
  when: string;
  note: string;
}

export const blankRequest = (timeZone: string): RequestFields => {
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  return { type: "measurement", when: `${toLocalInput(tomorrow, timeZone).slice(0, 10)}T10:00`, note: "" };
};

/** What, when, and a note: shared by the portal and the booking page. */
export function RequestFieldsForm({
  value,
  onChange,
  types,
}: {
  value: RequestFields;
  onChange: (v: RequestFields) => void;
  types: AppointmentType[];
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What for">
          {(p) => (
            <Select
              {...p}
              value={value.type}
              onChange={(e) => onChange({ ...value, type: e.target.value as AppointmentType })}
              data-cy="request-type"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {APPOINTMENT_TYPE[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Preferred date and time">
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              value={value.when}
              onChange={(e) => onChange({ ...value, when: e.target.value })}
              data-cy="request-when"
            />
          )}
        </Field>
      </div>
      <Field label="Anything we should know? (optional)">
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            value={value.note}
            maxLength={500}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            data-cy="request-note"
          />
        )}
      </Field>
    </>
  );
}

export function PublicMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-fg">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">{message}</p>
    </div>
  );
}
