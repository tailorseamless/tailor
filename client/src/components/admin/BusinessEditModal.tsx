import { useState } from "react";
import { useAdminActions } from "../../hooks/useOperations";
import type { AdminBusiness, AdminBusinessInput } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { isPhone } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Select } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { PhoneInput } from "../shared/PhoneInput";

const CURRENCIES = ["NGN", "GHS", "KES", "UGX", "TZS", "ZAR", "XOF", "EGP", "USD", "GBP", "EUR", "CAD", "AED"];
const TIME_ZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Abidjan",
  "Africa/Dakar",
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Africa/Addis_Ababa",
  "Africa/Johannesburg",
  "Africa/Harare",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Kinshasa",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Toronto",
  "Asia/Dubai",
];

/** The current value stays selectable even if it isn't in the usual list. */
const withCurrent = (options: string[], current: string) =>
  options.includes(current) ? options : [current, ...options];

/**
 * Support: change what an owner can't: the business email, currency and time zone, plus the usual details.
 * Only what was changed is sent, and the server records who changed what in that business's history.
 */
export function BusinessEditModal({ business, onClose }: { business: AdminBusiness; onClose: () => void }) {
  const { updateBusiness } = useAdminActions();
  const [name, setName] = useState(business.name);
  const [email, setEmail] = useState(business.email ?? "");
  const [phone, setPhone] = useState(business.phone ?? "");
  const [address, setAddress] = useState(business.address ?? "");
  const [currency, setCurrency] = useState(business.currency);
  const [timeZone, setTimeZone] = useState(business.timeZone);
  const [unit, setUnit] = useState(business.measurementUnit);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    setProblem(null);
    const input: AdminBusinessInput = {};
    if (name.trim() !== business.name) input.name = name.trim();
    if (email.trim().toLowerCase() !== (business.email ?? "")) input.email = email.trim().toLowerCase() || null;
    if (phone !== (business.phone ?? "")) input.phone = phone || null;
    if (address.trim() !== (business.address ?? "")) input.address = address.trim() || null;
    if (currency !== business.currency) input.currency = currency;
    if (timeZone !== business.timeZone) input.timeZone = timeZone;
    if (unit !== business.measurementUnit) input.measurementUnit = unit;

    if (Object.keys(input).length === 0) return setProblem("Change something first.");
    if (input.name !== undefined && input.name.length < 2) return setProblem("The business needs a name.");
    if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) return setProblem("That email address doesn't look right.");
    if (input.phone && !isPhone(input.phone)) return setProblem("That phone number doesn't look right.");
    updateBusiness.mutate(
      { id: business.id, input: { ...input, reason: reason.trim() || undefined } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${business.name}`}
      description="Details only. You can't see this business's customers or orders."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="admin-edit-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={updateBusiness.isPending} data-cy="admin-edit-save">
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (updateBusiness.error ? errorMessage(updateBusiness.error) : null)} />
        <Field label="Business name">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} data-cy="admin-edit-name" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" hint="Customers' replies go here.">
            {(p) => (
              <Input
                {...p}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-cy="admin-edit-email"
              />
            )}
          </Field>
          <Field label="Phone">
            {(p) => <PhoneInput {...p} value={phone} onChange={setPhone} data-cy="admin-edit-phone" />}
          </Field>
        </div>
        <Field label="Address">
          {(p) => (
            <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} data-cy="admin-edit-address" />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Currency">
            {(p) => (
              <Select
                {...p}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                data-cy="admin-edit-currency"
              >
                {withCurrent(CURRENCIES, business.currency).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Time zone">
            {(p) => (
              <Select
                {...p}
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                data-cy="admin-edit-timezone"
              >
                {withCurrent(TIME_ZONES, business.timeZone).map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Measure in">
            {(p) => (
              <Select
                {...p}
                value={unit}
                onChange={(e) => setUnit(e.target.value as AdminBusiness["measurementUnit"])}
                data-cy="admin-edit-unit"
              >
                <option value="in">Inches</option>
                <option value="cm">Centimetres</option>
              </Select>
            )}
          </Field>
        </div>
        {currency !== business.currency && (
          <p role="alert" className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg">
            Orders already taken keep their old currency, and reports add amounts without converting them. Only change
            the currency for a business with little or no money recorded.
          </p>
        )}
        <Field label="Why (optional)" hint="Kept in the business's history, with your name.">
          {(p) => (
            <Input
              {...p}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              data-cy="admin-edit-reason"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
