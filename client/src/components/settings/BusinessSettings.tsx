import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useUpdateBusiness } from "../../hooks/useAccount";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { BusinessInput, MeasurementUnit } from "../../types/auth.types";
import { errorMessage } from "../../utils/errors";
import { isPhone, orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { Field, FormError, Input, Select, Toggle } from "../shared/Field";
import { PhoneInput } from "../shared/PhoneInput";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;
const suggestSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** Business profile, booking page and customer emails (owners and managers). */
export function BusinessSettings() {
  const { business } = useWorkspace();
  const { refresh } = useAuth();
  const toast = useToast();
  const update = useUpdateBusiness();
  const [form, setForm] = useState({
    name: business.name,
    phone: business.phone ?? "",
    address: business.address ?? "",
    measurementUnit: business.measurementUnit,
    slug: business.slug ?? suggestSlug(business.name),
    bookingEnabled: business.bookingEnabled,
    emailCustomerReminders: business.emailCustomerReminders,
    emailReceipts: business.emailReceipts,
    emailOrderUpdates: business.emailOrderUpdates,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const bookingUrl = `${window.location.origin}/book/${form.slug}`;

  const save = (patch?: BusinessInput) => {
    setProblem(null);
    const body: BusinessInput = patch ?? {
      name: form.name.trim(),
      phone: orNull(form.phone),
      address: orNull(form.address),
      measurementUnit: form.measurementUnit,
    };
    if (!patch) {
      if ((body.name ?? "").length < 2) return setProblem("Enter your business name.");
      if (body.phone && !isPhone(body.phone)) return setProblem("Enter a valid phone number.");
    }
    if (body.slug !== undefined && body.slug !== null && !SLUG.test(body.slug)) {
      return setProblem("The booking link can use 3–60 lower-case letters, digits and dashes.");
    }
    update.mutate(body, { onSuccess: () => void refresh() });
  };

  return (
    <>
      <Card title="Business">
        <div className="space-y-4 p-4">
          <FormError message={problem ?? (update.error ? errorMessage(update.error) : null)} />
          <Field label="Business name">
            {(p) => <Input {...p} value={form.name} onChange={(e) => set("name", e.target.value)} data-cy="biz-name" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              {(p) => <PhoneInput {...p} value={form.phone} onChange={(v) => set("phone", v)} data-cy="biz-phone" />}
            </Field>
            <Field label="Email" hint="The email you signed up with. It can't be changed here.">
              {(p) => <Input {...p} type="email" value={business.email ?? ""} disabled readOnly data-cy="biz-email" />}
            </Field>
          </div>
          <Field label="Address" hint="Printed on receipts and shown on your booking page.">
            {(p) => (
              <Input
                {...p}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                data-cy="biz-address"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Measure in">
              {(p) => (
                <Select
                  {...p}
                  value={form.measurementUnit}
                  onChange={(e) => set("measurementUnit", e.target.value as MeasurementUnit)}
                  data-cy="biz-unit"
                >
                  <option value="in">Inches</option>
                  <option value="cm">Centimetres</option>
                </Select>
              )}
            </Field>
            <Field label="Currency and time zone" hint="Contact support to change these.">
              {(p) => <Input {...p} value={`${business.currency} · ${business.timeZone}`} disabled readOnly />}
            </Field>
          </div>
          <Button onClick={() => save()} loading={update.isPending} data-cy="biz-save">
            Save business details
          </Button>
        </div>
      </Card>

      <Card title="Online booking">
        <div className="space-y-4 p-4">
          <Toggle
            label="Let customers request appointments online"
            description="Requests land in your diary for you to accept or decline."
            checked={form.bookingEnabled}
            onChange={(on) => {
              set("bookingEnabled", on);
              save({ bookingEnabled: on, slug: form.slug.trim() || null });
            }}
            data-cy="biz-booking-toggle"
          />
          <Field label="Your booking link" hint={<span className="break-all">{bookingUrl}</span>}>
            {(p) => (
              <Input
                {...p}
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase())}
                data-cy="biz-slug"
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => save({ slug: form.slug.trim() || null })}
              loading={update.isPending}
              data-cy="biz-slug-save"
            >
              Save link
            </Button>
            {business.slug && business.bookingEnabled && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="size-4" aria-hidden />}
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/book/${business.slug}`).then(
                      () => toast.success("Link copied"),
                      () => toast.error("Couldn't copy"),
                    )
                  }
                  data-cy="biz-slug-copy"
                >
                  Copy
                </Button>
                <a
                  href={`/book/${business.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1 px-2 text-sm text-link hover:underline"
                  data-cy="biz-slug-open"
                >
                  <ExternalLink className="size-4" aria-hidden /> Open
                </a>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="Emails to customers">
        <div className="divide-y divide-line px-4 py-2">
          <Toggle
            label="Appointment reminders"
            description="Customers with an email get a reminder before their appointment."
            checked={form.emailCustomerReminders}
            onChange={(on) => {
              set("emailCustomerReminders", on);
              save({ emailCustomerReminders: on });
            }}
            data-cy="biz-email-reminders"
          />
          <Toggle
            label="Receipts"
            description="Email a receipt automatically when a payment is recorded."
            checked={form.emailReceipts}
            onChange={(on) => {
              set("emailReceipts", on);
              save({ emailReceipts: on });
            }}
            data-cy="biz-email-receipts"
          />
          <Toggle
            label="Order updates"
            description="Email customers when their order is ready for a fitting, ready to collect, and delivered."
            checked={form.emailOrderUpdates}
            onChange={(on) => {
              set("emailOrderUpdates", on);
              save({ emailOrderUpdates: on });
            }}
            data-cy="biz-email-order-updates"
          />
        </div>
      </Card>
    </>
  );
}
