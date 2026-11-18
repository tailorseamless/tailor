import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, FormProvider, useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { CustomerSelect, type PickedCustomer } from "../../components/shared/CustomerSelect";
import { Button, IconButton } from "../../components/shared/Button";
import { Card, PageHeader } from "../../components/shared/Display";
import { DatePicker } from "../../components/shared/DatePicker";
import { Field, FormError, Input, Select, Textarea } from "../../components/shared/Field";
import { MeasurementForm } from "../../components/customers/MeasurementForm";
import {
  blankPricing,
  checkPricing,
  ItemPricing,
  priceFields,
  toPricedLine,
  type PriceFormItem,
  type PriceFormShape,
} from "../../components/orders/ItemPricing";
import { useCustomer, useMeasurements } from "../../hooks/useCustomers";
import { useBranches, useDesigns } from "../../hooks/useTeam";
import { newOrderKey, useCreateOrder } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import { errorMessage } from "../../utils/errors";
import { formatDay } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { orderFigures } from "../../utils/orderMoney";
import { todayIn } from "../../utils/timezone";

const item = z
  .object({
    garmentName: z.string().trim().min(1, "Name the garment").max(120),
    description: z.string().trim().max(1000),
    quantity: z.coerce.number().int("Whole numbers only").min(1, "At least 1").max(1000),
    ...priceFields,
    fabricSource: z.enum(["customer", "business"]),
    measurementId: z.string(),
    designId: z.string(),
  })
  .superRefine(checkPricing);
const schema = z.object({
  dueDate: z.string(),
  notes: z.string().trim().max(2000),
  items: z.array(item).min(1).max(50),
});
type Values = z.input<typeof schema>;
type Parsed = z.output<typeof schema>;

const blankItem: Values["items"][number] = {
  garmentName: "",
  description: "",
  quantity: 1,
  ...blankPricing,
  fabricSource: "customer",
  measurementId: "",
  designId: "",
};

export default function NewOrderPage() {
  const { timeZone, currency, can } = useWorkspace();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = useCustomer(params.get("customer") ?? undefined);
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [customerError, setCustomerError] = useState<string>();
  const measurements = useMeasurements(customer?.id ?? "");
  const create = useCreateOrder();
  const designs = useDesigns({ limit: 100 });
  const branches = (useBranches().data?.data ?? []).filter((b) => b.status === "active");
  const [branchId, setBranchId] = useState("");
  // One key per order being typed: a double tap or a retry after a timeout can't create two orders.
  const key = useRef(newOrderKey());

  useEffect(() => {
    if (preset.data && !customer)
      setCustomer({ id: preset.data.id, fullName: preset.data.fullName, phone: preset.data.phone });
  }, [preset.data, customer]);

  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(schema),
    defaultValues: { dueDate: "", notes: "", items: [blankItem] },
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const watched = form.watch("items");
  const figures = orderFigures((watched as PriceFormItem[]).map(toPricedLine));
  const savedMeasurements = customer ? (measurements.data?.data ?? []) : [];
  const latestMeasurement = savedMeasurements[0];
  const [measuringFor, setMeasuringFor] = useState<number | null>(null);

  /** Why the dropdown is empty or off, and the way out: record measurements right here. */
  const measurementHint = (index: number): ReactNode => {
    if (!customer) return "Choose the customer above first. Their saved measurements appear here.";
    if (measurements.isPending) return "Loading their measurements…";
    const first = customer.fullName.split(" ")[0];
    return (
      <>
        {savedMeasurements.length === 0 ? `No measurements saved for ${first} yet. ` : ""}
        {can("measurement.record") && (
          <button
            type="button"
            onClick={() => setMeasuringFor(index)}
            className="text-link underline"
            data-cy="order-record-measurements"
          >
            {savedMeasurements.length === 0 ? "Record them now" : "Record new measurements"}
          </button>
        )}
      </>
    );
  };

  const submit = form.handleSubmit((values) => {
    if (!customer) return setCustomerError("Choose who the order is for");
    create.mutate(
      {
        key: key.current,
        input: {
          customerId: customer.id,
          branchId: branchId || null,
          dueDate: values.dueDate || null,
          notes: values.notes || null,
          items: values.items.map((i) => {
            const priced = toPricedLine(i);
            return {
              garmentName: i.garmentName,
              description: i.description || null,
              quantity: i.quantity,
              unitPrice: priced.unitPrice,
              estimateMin: priced.estimateMin ?? null,
              estimateMax: priced.estimateMax ?? null,
              discountType: priced.discountType ?? null,
              discountValue: priced.discountValue ?? null,
              fabricSource: i.fabricSource,
              measurementId: i.measurementId || null,
              designId: i.designId || null,
            };
          }),
        },
      },
      {
        onSuccess: (order) => {
          key.current = newOrderKey();
          navigate(`/orders/${order.id}`, { replace: true });
        },
      },
    );
  });

  const errors = form.formState.errors;
  return (
    <>
      <PageHeader back={{ to: "/orders", label: "Orders" }} title="New order" />
      {/* The pricing fields of each item read the form through context. */}
      <FormProvider {...(form as unknown as UseFormReturn<PriceFormShape>)}>
        <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3" noValidate>
          <div className="space-y-5 lg:col-span-2">
            <Card className="space-y-4 p-4">
              <FormError message={create.error ? errorMessage(create.error) : null} />
              <CustomerSelect
                value={customer}
                onChange={(c) => {
                  setCustomer(c);
                  setCustomerError(undefined);
                  // Measurements belong to one customer: don't carry the last customer's onto this order.
                  form.getValues("items").forEach((_, i) => form.setValue(`items.${i}.measurementId`, ""));
                }}
                error={customerError}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {branches.length > 0 && (
                  <Field label="Branch">
                    {(p) => (
                      <Select
                        {...p}
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        data-cy="order-branch"
                      >
                        <option value="">Main / not set</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
                <Field label="Due date (optional)" hint="When the customer expects to collect.">
                  {(p) => (
                    <Controller
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <DatePicker
                          {...p}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          min={todayIn(timeZone)}
                          timeZone={timeZone}
                          data-cy="order-due-date"
                        />
                      )}
                    />
                  )}
                </Field>
              </div>
            </Card>

            {items.fields.map((field, index) => {
              const e = errors.items?.[index];
              return (
                <Card
                  key={field.id}
                  title={`Item ${index + 1}`}
                  action={
                    items.fields.length > 1 && (
                      <IconButton
                        label={`Remove item ${index + 1}`}
                        onClick={() => items.remove(index)}
                        data-cy="order-item-remove"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    )
                  }
                >
                  <div className="grid gap-4 p-4 sm:grid-cols-2">
                    <Field label="Garment" error={e?.garmentName?.message} className="sm:col-span-2">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="e.g. Agbada, Kaftan, Wedding gown"
                          {...form.register(`items.${index}.garmentName`)}
                          data-cy="order-item-name"
                        />
                      )}
                    </Field>
                    <Field label="Quantity" error={e?.quantity?.message}>
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          {...form.register(`items.${index}.quantity`)}
                          data-cy="order-item-qty"
                        />
                      )}
                    </Field>
                    <ItemPricing index={index} currency={currency} />
                    <Field label="Fabric">
                      {(p) => (
                        <Select {...p} {...form.register(`items.${index}.fabricSource`)} data-cy="order-item-fabric">
                          <option value="customer">Customer brings fabric</option>
                          <option value="business">We supply fabric</option>
                        </Select>
                      )}
                    </Field>
                    <Field label="Measurements" hint={measurementHint(index)}>
                      {(p) => (
                        <Controller
                          control={form.control}
                          name={`items.${index}.measurementId`}
                          render={({ field }) => (
                            <Select
                              {...p}
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              disabled={!customer}
                              data-cy="order-item-measurement"
                            >
                              <option value="">
                                {!customer
                                  ? "Choose a customer first"
                                  : savedMeasurements.length
                                    ? "None"
                                    : "None saved yet"}
                              </option>
                              {savedMeasurements.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {formatDay(m.measuredOn)}
                                  {m.templateName ? ` · ${m.templateName}` : ""}
                                  {m.id === latestMeasurement?.id ? " (latest)" : ""}
                                </option>
                              ))}
                            </Select>
                          )}
                        />
                      )}
                    </Field>
                    {(designs.data?.data.length ?? 0) > 0 && (
                      <Field label="Design from your catalogue (optional)" className="sm:col-span-2">
                        {(p) => (
                          <Select {...p} {...form.register(`items.${index}.designId`)} data-cy="order-item-design">
                            <option value="">None</option>
                            {(designs.data?.data ?? []).map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                                {d.category ? ` · ${d.category}` : ""}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    )}
                    <Field label="Style notes (optional)" className="sm:col-span-2">
                      {(p) => (
                        <Textarea
                          {...p}
                          rows={2}
                          placeholder="Neckline, sleeves, lining…"
                          {...form.register(`items.${index}.description`)}
                          data-cy="order-item-description"
                        />
                      )}
                    </Field>
                  </div>
                </Card>
              );
            })}
            {items.fields.length < 50 && (
              <Button
                variant="secondary"
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => items.append({ ...blankItem, measurementId: latestMeasurement?.id ?? "" })}
                data-cy="order-add-item"
              >
                Add another item
              </Button>
            )}
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card className="space-y-4 p-4">
              <Field label="Order notes (optional)">
                {(p) => <Textarea {...p} rows={3} {...form.register("notes")} data-cy="order-notes" />}
              </Field>
              <dl className="space-y-1.5 border-t border-line pt-4">
                {figures.discount > 0 && (
                  <div className="flex items-baseline justify-between text-sm text-fg-muted">
                    <dt>Discounts</dt>
                    <dd className="tabular-nums" data-cy="order-discount">
                      −{formatMoney(figures.discount, currency)}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <dt className="text-sm text-fg-muted">{figures.pending ? "Agreed so far" : "Total"}</dt>
                  <dd className="text-xl font-semibold text-fg tabular-nums" data-cy="order-total">
                    {formatMoney(figures.total, currency)}
                  </dd>
                </div>
              </dl>
              {figures.pending && (
                <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg" data-cy="order-estimate">
                  Some prices are still to be agreed. Estimated total: {formatMoney(figures.min, currency)} –{" "}
                  {formatMoney(figures.max, currency)}.
                </p>
              )}
              <Button type="submit" className="w-full" loading={create.isPending} data-cy="order-submit">
                Create order
              </Button>
              <p className="text-xs text-fg-subtle">
                {figures.pending
                  ? "You can take a deposit up to the highest estimate, and set the final price from the order."
                  : "You can record a deposit on the next screen."}
              </p>
            </Card>
          </div>
        </form>
      </FormProvider>
      {measuringFor !== null && customer && (
        <MeasurementForm
          open
          onClose={() => setMeasuringFor(null)}
          customerId={customer.id}
          previous={latestMeasurement}
          // Pick what was just recorded for the item that asked.
          onSaved={(saved) => form.setValue(`items.${measuringFor}.measurementId`, saved.id, { shouldDirty: true })}
        />
      )}
    </>
  );
}
