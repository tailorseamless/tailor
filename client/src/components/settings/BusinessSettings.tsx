import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useUpdateBusiness } from "../../hooks/useAccount";
import { useSharePage } from "../../hooks/useSharePage";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { BusinessInput, MeasurementUnit } from "../../types/auth.types";
import { bankAccountProblem } from "../../utils/bankAccount";
import { errorMessage } from "../../utils/errors";
import { isReservedSlug, shopPath, shopUrl } from "../../utils/shopPath";
import { isPhone, orNull, whatsappLink } from "../../utils/validation";
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

/** The business cards, handed over one by one so the settings page can put them on different tabs. */
export interface BusinessCards {
  /** The business details. */
  business: ReactNode;
  /** Publish the page, its address and the appointment-request switch. */
  page: ReactNode;
  /** The bank details shown on the public page. */
  account: ReactNode;
  /** Which emails customers get. */
  emails: ReactNode;
}

/**
 * Business profile, public page and customer emails (owners and managers). The cards share one form, so this
 * stays mounted and hands them to `children`: the page decides where each goes, and nothing typed is lost
 * when someone switches tabs.
 */
export function BusinessSettings({ children }: { children: (cards: BusinessCards) => ReactNode }) {
  const { business } = useWorkspace();
  const { refresh } = useAuth();
  const { copy } = useSharePage();
  const update = useUpdateBusiness();
  // Its own mutation, so a problem saving the account shows under the account, not under the business details.
  const updateAccount = useUpdateBusiness();
  const [accountProblem, setAccountProblem] = useState<string | null>(null);
  const [form, setForm] = useState({
    bankName: business.bankName ?? "",
    accountNumber: business.accountNumber ?? "",
    accountName: business.accountName ?? "",
    name: business.name,
    phone: business.phone ?? "",
    address: business.address ?? "",
    measurementUnit: business.measurementUnit,
    slug: business.slug ?? suggestSlug(business.name),
    pageEnabled: business.pageEnabled,
    bookingEnabled: business.bookingEnabled,
    emailCustomerReminders: business.emailCustomerReminders,
    emailReceipts: business.emailReceipts,
    emailOrderUpdates: business.emailOrderUpdates,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const pageLink = shopUrl(form.slug);

  /** Saves the business details, or just `patch`. `onFail` puts a toggle back if the API said no. */
  const save = (patch?: BusinessInput, onFail?: () => void) => {
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
    if (body.slug !== undefined && body.slug !== null) {
      const problemWithSlug = !SLUG.test(body.slug)
        ? "The page address can use 3–60 lower-case letters, digits and dashes."
        : isReservedSlug(body.slug)
          ? "That address is reserved for the app. Try your business name instead."
          : null;
      if (problemWithSlug) {
        onFail?.();
        return setProblem(problemWithSlug);
      }
    }
    update.mutate(body, {
      onSuccess: (saved) => {
        // Publishing may have picked the address for them: show the one they actually got.
        if (body.pageEnabled !== undefined && saved.slug) set("slug", saved.slug);
        void refresh();
      },
      onError: onFail,
    });
  };

  /** Saves the account details shown on the public page; `clear` removes them. */
  const saveAccount = (clear = false) => {
    setAccountProblem(null);
    const account = clear
      ? { bankName: null, accountNumber: null, accountName: null }
      : {
          bankName: orNull(form.bankName),
          accountNumber: orNull(form.accountNumber),
          accountName: orNull(form.accountName),
        };
    const wrong = bankAccountProblem(account);
    if (wrong) return setAccountProblem(wrong);
    updateAccount.mutate(account, {
      onSuccess: () => {
        if (clear) setForm((f) => ({ ...f, bankName: "", accountNumber: "", accountName: "" }));
        void refresh();
      },
    });
  };
  const accountShown = Boolean(business.bankName && business.accountNumber && business.accountName);

  const businessCard = (
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
          <Field label="Address" hint="Printed on receipts and shown on your public page.">
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
    </>
  );

  const pageCard = (
    <>
      <Card title="Your public page">
        <div className="space-y-4 p-4">
          <p className="text-sm text-fg-muted">
            A page of your own with your designs, their price ranges and how to reach you. Send the link on WhatsApp,
            put it in your Instagram bio, or print it on your cards.
          </p>
          <Toggle
            label="Publish my page"
            description="Anyone with the link can see it: your business name, phone, email and address, and the designs you've marked “Show to customers”."
            checked={form.pageEnabled}
            onChange={(on) => {
              set("pageEnabled", on);
              if (!on) set("bookingEnabled", false); // the booking form goes down with the page
              // Left at our suggestion on a first publish? Send none, so a taken name gets another instead of an error.
              const typed = form.slug.trim();
              const untouched = !business.slug && typed === suggestSlug(business.name);
              save({ pageEnabled: on, ...(untouched ? {} : { slug: typed || null }) }, () => {
                set("pageEnabled", !on);
                if (!on) set("bookingEnabled", business.bookingEnabled);
              });
            }}
            data-cy="biz-page-toggle"
          />
          <Field label="Your page address" hint={<span className="break-all">{pageLink}</span>}>
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
              Save address
            </Button>
            {business.slug && business.pageEnabled && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="size-4" aria-hidden />}
                  onClick={() => void copy(shopUrl(business.slug as string))}
                  data-cy="biz-slug-copy"
                >
                  Copy link
                </Button>
                <a
                  href={whatsappLink(`${business.name}: see our designs and prices — ${shopUrl(business.slug)}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1 px-2 text-sm text-link hover:underline"
                  data-cy="biz-slug-whatsapp"
                >
                  <MessageCircle className="size-4" aria-hidden /> Share on WhatsApp
                </a>
                <a
                  href={shopPath(business.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1 px-2 text-sm text-link hover:underline"
                  data-cy="biz-slug-open"
                >
                  <ExternalLink className="size-4" aria-hidden /> Open my page
                </a>
              </>
            )}
          </div>
          <div className="border-t border-line pt-2">
            <Toggle
              label="Take appointment requests on my page"
              description={
                form.pageEnabled
                  ? "Visitors can ask for a time. Requests land in your diary for you to accept or decline."
                  : "Publish your page first."
              }
              checked={form.bookingEnabled}
              disabled={!form.pageEnabled}
              onChange={(on) => {
                set("bookingEnabled", on);
                save({ bookingEnabled: on }, () => set("bookingEnabled", !on));
              }}
              data-cy="biz-booking-toggle"
            />
          </div>
        </div>
      </Card>
    </>
  );

  const accountCard = (
    <>
      <Card title="Account details for customers">
        <div className="space-y-4 p-4">
          <p className="text-sm text-fg-muted">
            Where customers send deposits and balances. These show on your public page with a Copy button, so they don't
            have to ask. Anyone with your page link can see them. Leave all three empty to show nothing.
          </p>
          {!business.pageEnabled && (
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg" data-cy="biz-account-unpublished">
              Your page isn't published yet, so customers can't see these until you publish it.
            </p>
          )}
          <FormError message={accountProblem ?? (updateAccount.error ? errorMessage(updateAccount.error) : null)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bank">
              {(p) => (
                <Input
                  {...p}
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                  maxLength={100}
                  placeholder="e.g. GTBank"
                  data-cy="biz-bank-name"
                />
              )}
            </Field>
            <Field label="Account number">
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  maxLength={40}
                  data-cy="biz-account-number"
                />
              )}
            </Field>
            <Field label="Account name" hint="As the bank shows it.">
              {(p) => (
                <Input
                  {...p}
                  value={form.accountName}
                  onChange={(e) => set("accountName", e.target.value)}
                  maxLength={150}
                  data-cy="biz-account-name"
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveAccount()} loading={updateAccount.isPending} data-cy="biz-account-save">
              Save account details
            </Button>
            {accountShown && (
              <Button
                variant="ghost"
                onClick={() => saveAccount(true)}
                disabled={updateAccount.isPending}
                data-cy="biz-account-clear"
              >
                Remove them
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );

  const emailsCard = (
    <>
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

  return <>{children({ business: businessCard, page: pageCard, account: accountCard, emails: emailsCard })}</>;
}
