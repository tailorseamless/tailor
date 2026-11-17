import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { CustomerSelect, type PickedCustomer } from "../../components/shared/CustomerSelect";
import { Button, IconButton } from "../../components/shared/Button";
import { Card, PageHeader } from "../../components/shared/Display";
import { Field, FormError, Input, Select, Textarea } from "../../components/shared/Field";
import { useCustomer, useMeasurements } from "../../hooks/useCustomers";
import { useBranches, useDesigns } from "../../hooks/useTeam";
import { newOrderKey, useCreateOrder } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import { errorMessage } from "../../utils/errors";
import { formatDay } from "../../utils/formatDate";
import { formatMoney } from "../../utils/money";
import { todayIn } from "../../utils/timezone";

const item = z.object({
  garmentName: z.string().trim().min(1, "Name the garment").max(120),
  description: z.string().trim().max(1000),
  quantity: z.coerce.number().int("Whole numbers only").min(1, "At least 1").max(1000),
  unitPrice: z.coerce.number().min(0, "Can't be negative").max(999_999_999),
  fabricSource: z.enum(["customer", "business"]),
  measurementId: z.string(),
  designId: z.string(),
});
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
  unitPrice: 0,
  fabricSource: "customer",
  measurementId: "",
  designId: "",
};

export default function NewOrderPage() {
  const { timeZone, currency } = useWorkspace();
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
  const total = watched.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const latestMeasurement = customer ? measurements.data?.data[0] : undefined;

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
          items: values.items.map((i) => ({
            garmentName: i.garmentName,
            description: i.description || null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            fabricSource: i.fabricSource,
            measurementId: i.measurementId || null,
            designId: i.designId || null,
          })),
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
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3" noValidate>
        <div className="space-y-5 lg:col-span-2">
          <Card className="space-y-4 p-4">
            <FormError message={create.error ? errorMessage(create.error) : null} />
            <CustomerSelect
              value={customer}
              onChange={(c) => {
                setCustomer(c);
                setCustomerError(undefined);
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
                  <Input
                    {...p}
                    type="date"
                    min={todayIn(timeZone)}
                    {...form.register("dueDate")}
                    data-cy="order-due-date"
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
                  <Field label={`Price each (${currency})`} error={e?.unitPrice?.message}>
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        {...form.register(`items.${index}.unitPrice`)}
                        data-cy="order-item-price"
                      />
                    )}
                  </Field>
                  <Field label="Fabric">
                    {(p) => (
                      <Select {...p} {...form.register(`items.${index}.fabricSource`)} data-cy="order-item-fabric">
                        <option value="customer">Customer brings fabric</option>
                        <option value="business">We supply fabric</option>
                      </Select>
                    )}
                  </Field>
                  <Field label="Measurements">
                    {(p) => (
                      <Select
                        {...p}
                        {...form.register(`items.${index}.measurementId`)}
                        disabled={!customer}
                        data-cy="order-item-measurement"
                      >
                        <option value="">None</option>
                        {(measurements.data?.data ?? []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatDay(m.measuredOn)}
                            {m.templateName ? ` · ${m.templateName}` : ""}
                            {m.id === latestMeasurement?.id ? " (latest)" : ""}
                          </option>
                        ))}
                      </Select>
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
            <div className="flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-sm text-fg-muted">Total</span>
              <span className="text-xl font-semibold text-fg tabular-nums" data-cy="order-total">
                {formatMoney(total, currency)}
              </span>
            </div>
            <Button type="submit" className="w-full" loading={create.isPending} data-cy="order-submit">
              Create order
            </Button>
            <p className="text-xs text-fg-subtle">You can record a deposit on the next screen.</p>
          </Card>
        </div>
      </form>
    </>
  );
}
