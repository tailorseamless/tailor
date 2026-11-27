import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useCustomerLookup } from "../../hooks/useCapture";
import type { MeasurementTemplate } from "../../types/customer.types";
import { cn } from "../../utils/cn";
import { formatMoney } from "../../utils/money";
import { Button, IconButton } from "../shared/Button";
import { Badge, Card } from "../shared/Display";
import { DatePicker } from "../shared/DatePicker";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import {
  isSaved,
  problemsOf,
  type EditableItem,
  type EditableMeasurement,
  type EditableOrder,
  type EditableRecord,
} from "./captureDraft";

interface Props {
  index: number;
  record: EditableRecord;
  onChange: (record: EditableRecord) => void;
  templates: MeasurementTemplate[];
  currency: string;
  timeZone: string;
  today: string;
  /** Saving is under way: nothing can change. */
  busy: boolean;
}

const newKey = () => crypto.randomUUID();

function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-fg">
      <input
        type="checkbox"
        className="size-4 accent-brand"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** One customer found in the photos, with their measurements and orders, ready to check and change. */
export function CaptureRecordCard({ index, record, onChange, templates, currency, timeZone, today, busy }: Props) {
  const lookup = useCustomerLookup();
  const saved = isSaved(record);
  const problems = record.include && !saved ? problemsOf(record, templates) : [];
  const set = (patch: Partial<EditableRecord>) => onChange({ ...record, ...patch, error: null });
  const customerLocked = busy || record.customerId !== null;
  const title =
    record.target === "existing" && record.match ? record.match.fullName : record.fullName || `Customer ${index + 1}`;

  /** The server found another customer with this number: add the record to them instead. */
  const addToDuplicate = () => {
    const id = record.duplicateOf;
    if (!id) return;
    const fallback = { id, fullName: record.fullName, phone: record.phone, by: "phone" as const };
    lookup.mutate(id, {
      onSuccess: (c) =>
        set({
          target: "existing",
          match: { id: c.id, fullName: c.fullName, phone: c.phone, by: "phone" },
          duplicateOf: null,
        }),
      onError: () => set({ target: "existing", match: fallback, duplicateOf: null }),
    });
  };

  return (
    <Card className={cn(!record.include && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <Checkbox
          checked={record.include}
          onChange={(include) => set({ include })}
          label={`${index + 1}. ${title}`}
          disabled={busy || saved}
        />
        <div className="ml-auto flex items-center gap-2">
          {saved ? (
            <Badge tone="success">
              <CheckCircle2 className="mr-1 size-3.5" aria-hidden />
              Saved
            </Badge>
          ) : record.include && problems.length ? (
            <Badge tone="warning">Needs a look</Badge>
          ) : record.include ? (
            <Badge tone="info">Ready</Badge>
          ) : (
            <Badge>Left out</Badge>
          )}
          {record.customerId && (
            <Link to={`/customers/${record.customerId}`} className="text-xs text-link hover:underline">
              Open customer
            </Link>
          )}
        </div>
      </div>

      {record.include && (
        <div className="space-y-5 p-4">
          <FormError message={record.error} />
          {record.duplicateOf && !record.confirmDuplicate && !record.customerId && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={addToDuplicate} disabled={busy}>
                Add to that customer
              </Button>
              <Button size="sm" variant="secondary" onClick={() => set({ confirmDuplicate: true })} disabled={busy}>
                Keep as a new customer
              </Button>
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-fg">Customer</h3>
            {record.match && (
              <div className="space-y-2 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-fg">
                <p>
                  {record.match.by === "phone"
                    ? `Already in your customers: ${record.match.fullName} (${record.match.phone}).`
                    : `You already have a customer called ${record.match.fullName} (${record.match.phone}). Is this the same person?`}
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="accent-brand"
                      checked={record.target === "existing"}
                      disabled={customerLocked}
                      onChange={() => set({ target: "existing" })}
                    />
                    Add to {record.match.fullName}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="accent-brand"
                      checked={record.target === "new"}
                      disabled={customerLocked}
                      onChange={() => set({ target: "new" })}
                    />
                    It's a new customer
                  </label>
                </div>
              </div>
            )}
            {record.target === "new" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  {(p) => (
                    <Input
                      {...p}
                      value={record.fullName}
                      maxLength={150}
                      disabled={customerLocked}
                      onChange={(e) => set({ fullName: e.target.value })}
                    />
                  )}
                </Field>
                <Field
                  label="Phone"
                  hint={
                    record.phoneAsWritten
                      ? `On the paper: “${record.phoneAsWritten}”. Check the number.`
                      : !record.phone
                        ? "Not on the paper. Every customer needs a phone number."
                        : undefined
                  }
                >
                  {(p) => (
                    <Input
                      {...p}
                      value={record.phone}
                      inputMode="tel"
                      maxLength={30}
                      disabled={customerLocked}
                      onChange={(e) => set({ phone: e.target.value, duplicateOf: null, confirmDuplicate: false })}
                    />
                  )}
                </Field>
                <Field label="Gender">
                  {(p) => (
                    <Select
                      {...p}
                      value={record.gender}
                      disabled={customerLocked}
                      onChange={(e) => set({ gender: e.target.value as EditableRecord["gender"] })}
                    >
                      <option value="">Not said</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </Select>
                  )}
                </Field>
                <Field label="Notes">
                  {(p) => (
                    <Input
                      {...p}
                      value={record.notes}
                      maxLength={2000}
                      disabled={customerLocked}
                      onChange={(e) => set({ notes: e.target.value })}
                    />
                  )}
                </Field>
              </div>
            )}
          </section>

          {record.measurement && (
            <MeasurementSection
              measurement={record.measurement}
              onChange={(measurement) => set({ measurement })}
              templates={templates}
              timeZone={timeZone}
              today={today}
              busy={busy}
            />
          )}

          {record.orders.map((order, i) => (
            <OrderSection
              key={order.key}
              label={record.orders.length > 1 ? `Order ${i + 1}` : "Order"}
              order={order}
              onChange={(next) => set({ orders: record.orders.map((o) => (o.key === order.key ? next : o)) })}
              currency={currency}
              timeZone={timeZone}
              busy={busy}
            />
          ))}

          {problems.length > 0 && (
            <ul className="list-disc space-y-1 rounded-lg bg-warning-bg py-2 pr-3 pl-7 text-sm text-warning-fg">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function MeasurementSection({
  measurement: m,
  onChange,
  templates,
  timeZone,
  today,
  busy,
}: {
  measurement: EditableMeasurement;
  onChange: (m: EditableMeasurement) => void;
  templates: MeasurementTemplate[];
  timeZone: string;
  today: string;
  busy: boolean;
}) {
  const locked = busy || m.savedId !== null;
  const set = (patch: Partial<EditableMeasurement>) => onChange({ ...m, ...patch });
  const setValue = (key: string, patch: Partial<EditableMeasurement["values"][number]>) =>
    set({ values: m.values.map((v) => (v.key === key ? { ...v, ...patch } : v)) });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Checkbox checked={m.include} onChange={(include) => set({ include })} label="Measurements" disabled={locked} />
        {m.savedId && <Badge tone="success">Saved</Badge>}
      </div>
      {m.include && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Garment template">
              {(p) => (
                <Select
                  {...p}
                  value={m.templateId}
                  disabled={locked}
                  onChange={(e) => set({ templateId: e.target.value })}
                >
                  <option value="">None (free-form)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Unit"
              hint={m.unitAssumed ? "Not written on the paper: your usual unit. Check it." : undefined}
            >
              {(p) => (
                <Select
                  {...p}
                  value={m.unit}
                  disabled={locked}
                  onChange={(e) => set({ unit: e.target.value as "in" | "cm", unitAssumed: false })}
                >
                  <option value="in">Inches</option>
                  <option value="cm">Centimetres</option>
                </Select>
              )}
            </Field>
            <Field label="Measured on" hint={m.measuredOn ? undefined : "Not on the paper: today is used."}>
              {(p) => (
                <DatePicker
                  {...p}
                  value={m.measuredOn}
                  onChange={(measuredOn) => set({ measuredOn })}
                  max={today}
                  timeZone={timeZone}
                  disabled={locked}
                />
              )}
            </Field>
          </div>

          <ul className="space-y-2">
            {m.values.map((v) => (
              <li key={v.key} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label="Measurement"
                    value={v.name}
                    maxLength={80}
                    disabled={locked}
                    onChange={(e) => setValue(v.key, { name: e.target.value })}
                  />
                  {v.asWritten && v.asWritten.toLowerCase() !== v.name.trim().toLowerCase() && (
                    <p className="mt-0.5 text-xs text-fg-subtle">Written as “{v.asWritten}”</p>
                  )}
                </div>
                <Input
                  aria-label={`${v.name || "Measurement"} value`}
                  className="w-24"
                  inputMode="decimal"
                  value={v.value}
                  disabled={locked}
                  onChange={(e) => setValue(v.key, { value: e.target.value })}
                />
                <IconButton
                  label="Remove this measurement"
                  disabled={locked}
                  onClick={() => set({ values: m.values.filter((x) => x.key !== v.key) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
          {!locked && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => set({ values: [...m.values, { key: newKey(), name: "", value: "", asWritten: "" }] })}
            >
              Add a measurement
            </Button>
          )}
          <Field label="Measurement notes">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={m.notes}
                maxLength={2000}
                disabled={locked}
                onChange={(e) => set({ notes: e.target.value })}
              />
            )}
          </Field>
        </>
      )}
    </section>
  );
}

function OrderSection({
  label,
  order,
  onChange,
  currency,
  timeZone,
  busy,
}: {
  label: string;
  order: EditableOrder;
  onChange: (o: EditableOrder) => void;
  currency: string;
  timeZone: string;
  busy: boolean;
}) {
  const locked = busy || order.savedId !== null;
  const set = (patch: Partial<EditableOrder>) => onChange({ ...order, ...patch });
  const setItem = (key: string, patch: Partial<EditableItem>) =>
    set({ items: order.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox checked={order.include} onChange={(include) => set({ include })} label={label} disabled={locked} />
        <div className="flex gap-2">
          {order.finished && <Badge tone="neutral">Marked collected on the paper</Badge>}
          {order.savedId && (
            <Link to={`/orders/${order.savedId}`} className="text-xs text-link hover:underline">
              Order {order.savedNumber} saved
            </Link>
          )}
        </div>
      </div>
      {order.finished && !order.include && !order.savedId && (
        <p className="text-xs text-fg-muted">
          Left out because it looks finished. Tick it to add it as an order anyway.
        </p>
      )}
      {order.include && (
        <>
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.key} className="grid grid-cols-[1fr_4.5rem_7rem_auto] items-start gap-2">
                <Input
                  aria-label="Garment"
                  placeholder="Garment"
                  value={item.garmentName}
                  maxLength={150}
                  disabled={locked}
                  onChange={(e) => setItem(item.key, { garmentName: e.target.value })}
                />
                <Input
                  aria-label="Quantity"
                  inputMode="numeric"
                  value={item.quantity}
                  disabled={locked}
                  onChange={(e) => setItem(item.key, { quantity: e.target.value })}
                />
                <Input
                  aria-label={`Price of one (${currency})`}
                  inputMode="decimal"
                  placeholder={item.priceKnown ? "" : "No price"}
                  value={item.unitPrice}
                  disabled={locked}
                  onChange={(e) => setItem(item.key, { unitPrice: e.target.value })}
                />
                <IconButton
                  label="Remove this garment"
                  disabled={locked || order.items.length === 1}
                  onClick={() => set({ items: order.items.filter((x) => x.key !== item.key) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
                {item.description && <p className="col-span-4 -mt-1 text-xs text-fg-subtle">{item.description}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-fg-subtle">
            Garment · quantity · price of one ({currency}). Leave the price empty if it isn't agreed yet.
          </p>
          {!locked && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() =>
                set({
                  items: [
                    ...order.items,
                    {
                      key: newKey(),
                      garmentName: "",
                      quantity: "1",
                      unitPrice: "",
                      priceKnown: false,
                      description: "",
                    },
                  ],
                })
              }
            >
              Add a garment
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Due date">
              {(p) => (
                <DatePicker
                  {...p}
                  value={order.dueDate}
                  onChange={(dueDate) => set({ dueDate })}
                  timeZone={timeZone}
                  disabled={locked}
                />
              )}
            </Field>
            <Field label="Order notes">
              {(p) => (
                <Input
                  {...p}
                  value={order.notes}
                  maxLength={1500}
                  disabled={locked}
                  onChange={(e) => set({ notes: e.target.value })}
                />
              )}
            </Field>
          </div>
          {order.amountPaid !== null && (
            <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-fg-muted">
              The paper says {formatMoney(order.amountPaid, currency)} was paid. It goes in the order's notes; record it
              as a payment on the order afterwards, choosing how it was paid.
            </p>
          )}
        </>
      )}
    </section>
  );
}
