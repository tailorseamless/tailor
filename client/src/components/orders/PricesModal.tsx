import { useState } from "react";
import { useSetPrices } from "../../hooks/useOrders";
import type { DiscountType, OrderDetail, OrderItem } from "../../types/order.types";
import { errorMessage } from "../../utils/errors";
import { formatMoney } from "../../utils/money";
import { lineDiscount, lineNet, orderFigures, type PricedLine } from "../../utils/orderMoney";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Select } from "../shared/Field";
import { Modal } from "../shared/Modal";

interface Row {
  id: string;
  /** Text while typing. Empty = still not agreed. */
  unitPrice: string;
  discountType: "" | DiscountType;
  discountValue: string;
}

const MAX = 999_999_999;
const num = (value: string): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const startRow = (item: OrderItem): Row => ({
  id: item.id,
  unitPrice: item.unitPrice > 0 ? String(item.unitPrice) : "",
  discountType: item.discountType ?? "",
  discountValue: item.discountValue != null ? String(item.discountValue) : "",
});

const toLine = (item: OrderItem, row: Row): PricedLine => {
  const discount = num(row.discountValue);
  const has = row.discountType !== "" && discount > 0;
  return {
    quantity: item.quantity,
    unitPrice: num(row.unitPrice),
    estimateMin: item.estimateMin,
    estimateMax: item.estimateMax,
    discountType: has ? (row.discountType as DiscountType) : null,
    discountValue: has ? discount : null,
  };
};

/** What is wrong with one row, if anything: the same rules the API applies. */
function problemWith(item: OrderItem, row: Row, currency: string): { price?: string; discount?: string } {
  const out: { price?: string; discount?: string } = {};
  const price = num(row.unitPrice);
  if (row.unitPrice.trim() !== "" && (!Number.isFinite(Number(row.unitPrice)) || price < 0 || price > MAX)) {
    out.price = "Enter an amount";
  }
  const discount = num(row.discountValue);
  if (row.discountType !== "" && discount > 0) {
    if (row.discountType === "percent" && discount > 100) out.discount = "Can't be more than 100%";
    else if (row.discountType === "amount" && price > 0 && discount > item.quantity * price) {
      out.discount = `Can't be more than ${formatMoney(item.quantity * price, currency)}`;
    }
  }
  return out;
}

/**
 * Agree the final price and discount of each item. Open until the order is closed: the price is often settled after
 * the work has started, and a discount at collection is common.
 */
export function PricesModal({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const setPrices = useSetPrices(order.id);
  const [rows, setRows] = useState<Row[]>(() => order.items.map(startRow));
  const money = (n: number) => formatMoney(n, order.currency);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const lines = order.items.map((item, i) => toLine(item, rows[i]));
  const figures = orderFigures(lines);
  const problems = order.items.map((item, i) => problemWith(item, rows[i], order.currency));
  const invalid = problems.some((p) => p.price || p.discount);
  // What has been received may not exceed what is now owed (or, while a price is open, the top of the estimate).
  const ceiling = figures.pending ? figures.max : figures.total;
  const belowPaid = Math.round(ceiling * 100) < Math.round(order.amountPaid * 100);

  const save = () =>
    setPrices.mutate(
      order.items.map((item, i) => ({
        id: item.id,
        unitPrice: lines[i].unitPrice,
        discountType: lines[i].discountType ?? null,
        discountValue: lines[i].discountValue ?? null,
      })),
      { onSuccess: onClose },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={order.pricePending ? "Set the final price" : "Prices and discounts"}
      description="Changes show in the balance and on the customer's page straight away."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="prices-cancel">
            Cancel
          </Button>
          <Button loading={setPrices.isPending} disabled={invalid || belowPaid} onClick={save} data-cy="prices-save">
            Save prices
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={setPrices.error ? errorMessage(setPrices.error) : null} />
        <ul className="space-y-3">
          {order.items.map((item, i) => {
            const row = rows[i];
            const line = lines[i];
            const quote =
              item.estimateMin !== null && item.estimateMax !== null
                ? { min: item.estimateMin, max: item.estimateMax }
                : null;
            const outside =
              quote !== null && line.unitPrice > 0 && (line.unitPrice < quote.min || line.unitPrice > quote.max);
            const discount = lineDiscount(line);
            return (
              <li key={item.id} className="space-y-3 rounded-xl border border-line p-3" data-cy="prices-item">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium text-fg">
                    {item.quantity > 1 && `${item.quantity} × `}
                    {item.garmentName}
                  </p>
                  {quote && (
                    <p className="text-xs text-fg-muted">
                      Quoted {money(quote.min)} – {money(quote.max)} each
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field
                    label={`Final price each (${order.currency})`}
                    error={problems[i].price}
                    hint={outside ? "Outside the quoted range." : undefined}
                  >
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={row.unitPrice}
                        onChange={(e) => update(item.id, { unitPrice: e.target.value })}
                        data-cy="prices-unit"
                      />
                    )}
                  </Field>
                  <Field label="Discount">
                    {(p) => (
                      <Select
                        {...p}
                        value={row.discountType}
                        onChange={(e) => {
                          const type = e.target.value as Row["discountType"];
                          update(item.id, { discountType: type, ...(type === "" ? { discountValue: "" } : {}) });
                        }}
                        data-cy="prices-discount-type"
                      >
                        <option value="">None</option>
                        <option value="percent">Percent off (%)</option>
                        <option value="amount">Amount off ({order.currency})</option>
                      </Select>
                    )}
                  </Field>
                  <Field
                    label={row.discountType === "amount" ? `Amount off (${order.currency})` : "Percent off (%)"}
                    error={problems[i].discount}
                    hint={
                      item.quantity > 1 && row.discountType ? `Off all ${item.quantity} pieces together.` : undefined
                    }
                  >
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        disabled={row.discountType === ""}
                        value={row.discountValue}
                        onChange={(e) => update(item.id, { discountValue: e.target.value })}
                        data-cy="prices-discount-value"
                      />
                    )}
                  </Field>
                </div>
                {line.unitPrice > 0 && (
                  <p className="text-sm text-fg-muted">
                    {item.quantity} × {money(line.unitPrice)}
                    {discount > 0 ? `, less ${money(discount)}` : ""} ={" "}
                    <strong className="text-fg">{money(lineNet(line))}</strong>
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <dl className="space-y-1.5 rounded-xl bg-subtle p-3 text-sm">
          {figures.discount > 0 && (
            <div className="flex justify-between text-fg-muted">
              <dt>Discounts</dt>
              <dd className="tabular-nums">−{money(figures.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between font-medium text-fg">
            <dt>{figures.pending ? "Agreed so far" : "New total"}</dt>
            <dd className="tabular-nums" data-cy="prices-total">
              {money(figures.total)}
            </dd>
          </div>
          {figures.pending && (
            <div className="flex justify-between text-warning-fg">
              <dt>Still to agree</dt>
              <dd className="tabular-nums">
                Estimated {money(figures.min)} – {money(figures.max)}
              </dd>
            </div>
          )}
          <div className="flex justify-between text-fg-muted">
            <dt>Received so far</dt>
            <dd className="tabular-nums">{money(order.amountPaid)}</dd>
          </div>
        </dl>
        {belowPaid && (
          <p
            role="alert"
            className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg"
            data-cy="prices-below-paid"
          >
            This order has already received {money(order.amountPaid)}, which is more than{" "}
            {figures.pending ? "the top of the estimate" : "this total"}. Refund the difference first, or keep the total
            at or above what was received.
          </p>
        )}
      </div>
    </Modal>
  );
}
