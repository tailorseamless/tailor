import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import { cn } from "../../utils/cn";
import { formatMoney } from "../../utils/money";
import { lineDiscount, lineNet, orderFigures, type PricedLine } from "../../utils/orderMoney";
import { Field, Input, Select } from "../shared/Field";

/** The pricing fields of one garment as the form holds them (text while typing). */
export interface PriceFormItem {
  quantity: number | string;
  /** "fixed": the price is agreed. "range": quote a from–to now and agree the price later. */
  pricing: "fixed" | "range";
  unitPrice: number | string;
  estimateMin: string;
  estimateMax: string;
  discountType: "" | "amount" | "percent";
  discountValue: string;
}
export interface PriceFormShape {
  items: PriceFormItem[];
}

const MAX = 999_999_999;
const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= MAX), "Enter an amount");

/** The zod fields for one garment's pricing: spread into the item schema, then add `checkPricing`. */
export const priceFields = {
  pricing: z.enum(["fixed", "range"]),
  unitPrice: z.coerce.number().min(0, "Can't be negative").max(MAX),
  estimateMin: optionalMoney,
  estimateMax: optionalMoney,
  discountType: z.enum(["", "amount", "percent"]),
  discountValue: optionalMoney,
};

export const blankPricing = {
  pricing: "fixed" as const,
  unitPrice: 0,
  estimateMin: "",
  estimateMax: "",
  discountType: "" as const,
  discountValue: "",
};

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const blankToNull = (value: string): number | null => (value.trim() === "" ? null : num(value));

/** What the form holds → what the money rules (and the API) understand. */
export function toPricedLine(item: PriceFormItem): PricedLine {
  const range = item.pricing === "range";
  const discount = num(item.discountValue);
  return {
    quantity: Math.max(0, Math.floor(num(item.quantity))),
    unitPrice: range ? 0 : num(item.unitPrice),
    estimateMin: range ? blankToNull(item.estimateMin) : null,
    estimateMax: range ? blankToNull(item.estimateMax) : null,
    discountType: discount > 0 && item.discountType ? item.discountType : null,
    discountValue: discount > 0 && item.discountType ? discount : null,
  };
}

/** The rules that involve more than one field (the same ones the API enforces). */
export function checkPricing(
  item: Omit<PriceFormItem, "quantity" | "unitPrice"> & { quantity: number; unitPrice: number },
  ctx: z.RefinementCtx,
): void {
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (item.pricing === "range") {
    const min = blankToNull(item.estimateMin);
    const max = blankToNull(item.estimateMax);
    if (min === null) add("estimateMin", "Enter the lowest price");
    if (max === null) add("estimateMax", "Enter the highest price");
    if (min !== null && max !== null && min > max) add("estimateMax", "Can't be lower than the lowest price");
  }
  const discount = num(item.discountValue);
  if (discount <= 0) return;
  if (!item.discountType) add("discountType", "Choose an amount or a percentage");
  else if (item.discountType === "percent" && discount > 100) add("discountValue", "Can't be more than 100%");
  else if (item.discountType === "amount" && item.pricing === "fixed") {
    const gross = item.quantity * item.unitPrice;
    if (gross > 0 && discount > gross) add("discountValue", "Can't be more than the price");
  }
}

/**
 * Price, optional quote range and optional discount for one garment. Renders into the item's grid (a fragment),
 * and reads and writes the form through context.
 */
export function ItemPricing({ index, currency }: { index: number; currency: string }) {
  const { register, watch, setValue, formState } = useFormContext<PriceFormShape>();
  const item = watch(`items.${index}`);
  const errors = formState.errors.items?.[index];
  const labelId = useId();
  const [discountOpen, setDiscountOpen] = useState(item.discountType !== "" || item.discountValue !== "");

  const money = (n: number) => formatMoney(n, currency);
  const line = toPricedLine(item);
  const range = item.pricing === "range";
  const set = <K extends keyof PriceFormItem>(key: K, value: PriceFormItem[K]) =>
    setValue(`items.${index}.${key}`, value as never, { shouldDirty: true, shouldValidate: formState.isSubmitted });

  const openDiscount = () => {
    // Percent is the usual way to reward a bigger order, so start there.
    if (item.discountType === "") set("discountType", "percent");
    setDiscountOpen(true);
  };
  const removeDiscount = () => {
    set("discountType", "");
    set("discountValue", "");
    setDiscountOpen(false);
  };

  // One plain sentence showing what the customer is being charged for this item.
  let summary: string | null = null;
  if (range) {
    const f = orderFigures([line]);
    if (line.estimateMin !== null && line.estimateMax !== null) {
      summary = `Estimated ${money(f.min)} – ${money(f.max)}${line.discountType ? " after the discount" : ""}. You'll agree the final price later.`;
    }
  } else if (line.unitPrice > 0 && (line.quantity > 1 || line.discountType)) {
    const gross = money(line.quantity * line.unitPrice);
    summary = line.discountType
      ? `${line.quantity} × ${money(line.unitPrice)} = ${gross}, less ${money(lineDiscount(line))} discount = ${money(lineNet(line))}`
      : `${line.quantity} × ${money(line.unitPrice)} = ${gross}`;
  }

  return (
    <>
      <div className="space-y-1.5">
        <span id={labelId} className="block text-sm font-medium text-fg">
          Pricing
        </span>
        <div
          role="group"
          aria-labelledby={labelId}
          className="flex h-10 rounded-lg border border-control bg-surface p-0.5"
        >
          {(["fixed", "range"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={item.pricing === mode}
              onClick={() => set("pricing", mode)}
              className={cn(
                "flex-1 rounded-md px-3 text-sm font-medium transition-colors",
                item.pricing === mode ? "bg-brand-soft text-link" : "text-fg-muted hover:text-fg",
              )}
              data-cy={`order-item-pricing-${mode}`}
            >
              {mode === "fixed" ? "Fixed price" : "Quote a range"}
            </button>
          ))}
        </div>
      </div>

      {range ? (
        <>
          <Field label={`Lowest price each (${currency})`} error={errors?.estimateMin?.message}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                {...register(`items.${index}.estimateMin`)}
                data-cy="order-item-estimate-min"
              />
            )}
          </Field>
          <Field
            label={`Highest price each (${currency})`}
            error={errors?.estimateMax?.message}
            hint="A quote now. You set the final price once it's agreed."
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                {...register(`items.${index}.estimateMax`)}
                data-cy="order-item-estimate-max"
              />
            )}
          </Field>
        </>
      ) : (
        <Field label={`Price each (${currency})`} error={errors?.unitPrice?.message} className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              {...register(`items.${index}.unitPrice`)}
              data-cy="order-item-price"
            />
          )}
        </Field>
      )}

      {discountOpen ? (
        <div className="space-y-3 rounded-xl bg-subtle p-3 sm:col-span-2" data-cy="order-item-discount">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg">Discount on this item</span>
            <button
              type="button"
              onClick={removeDiscount}
              className="min-h-8 rounded-lg px-2 text-sm text-link hover:underline"
              data-cy="order-item-discount-remove"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Taken off as" error={errors?.discountType?.message}>
              {(p) => (
                <Select {...p} {...register(`items.${index}.discountType`)} data-cy="order-item-discount-type">
                  <option value="percent">A percentage (%)</option>
                  <option value="amount">A fixed amount ({currency})</option>
                </Select>
              )}
            </Field>
            <Field
              label={item.discountType === "amount" ? `Amount off (${currency})` : "Percent off (%)"}
              error={errors?.discountValue?.message}
              hint={
                line.quantity > 1
                  ? `Taken off all ${line.quantity} pieces together.`
                  : "Taken off the price of this item."
              }
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  {...register(`items.${index}.discountValue`)}
                  data-cy="order-item-discount-value"
                />
              )}
            </Field>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openDiscount}
          className="inline-flex min-h-8 items-center gap-1.5 justify-self-start rounded-lg text-sm text-link hover:underline sm:col-span-2"
          data-cy="order-item-add-discount"
        >
          <Plus className="size-4" aria-hidden />
          {line.quantity > 1 ? "Add a discount (good for more than one piece)" : "Add a discount"}
        </button>
      )}

      {summary && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-fg sm:col-span-2" data-cy="order-item-summary">
          {summary}
        </p>
      )}
    </>
  );
}
