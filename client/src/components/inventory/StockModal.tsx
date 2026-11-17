import { useRef, useState } from "react";
import { newRequestKey, useMaterialActions, useMovements } from "../../hooks/useOperations";
import { useOrders } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Material, StockKind } from "../../types/workspace.types";
import { cn } from "../../utils/cn";
import { errorMessage } from "../../utils/errors";
import { formatDateTime } from "../../utils/formatDate";
import { STOCK_KIND } from "../../utils/labels";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Select } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { QueryState } from "../shared/States";

/** Record stock bought, used (optionally on an order) or counted, and see the history. */
export function StockModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { can, timeZone, currency } = useWorkspace();
  const { move } = useMaterialActions();
  const history = useMovements(material.id);
  const key = useRef(newRequestKey());
  const [kind, setKind] = useState<StockKind>("usage");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(material.unitCost?.toString() ?? "");
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const orders = useOrders({ unfinished: true, sort: "due", limit: 100 }, kind === "usage");
  const canRecord = can("inventory.stock");

  const save = () => {
    setProblem(null);
    const qty = Number(quantity);
    if (quantity.trim() === "" || !(qty >= 0) || (kind !== "adjustment" && qty === 0))
      return setProblem("Enter a quantity.");
    if (kind === "usage" && qty > material.quantity)
      return setProblem(`Only ${material.quantity} ${material.unit} in stock.`);
    move.mutate(
      {
        id: material.id,
        key: key.current,
        input: {
          kind,
          quantity: qty,
          ...(kind === "purchase" && unitCost ? { unitCost: Number(unitCost) } : {}),
          orderId: kind === "usage" && orderId ? orderId : null,
          note: note.trim() || null,
        },
      },
      {
        onSuccess: () => {
          key.current = newRequestKey();
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={material.name}
      description={`${material.quantity} ${material.unit} in stock`}
      footer={
        canRecord ? (
          <>
            <Button variant="secondary" onClick={onClose} data-cy="stock-cancel">
              Close
            </Button>
            <Button onClick={save} loading={move.isPending} data-cy="stock-save">
              Record
            </Button>
          </>
        ) : undefined
      }
    >
      {canRecord && (
        <div className="space-y-4">
          <FormError message={problem ?? (move.error ? errorMessage(move.error) : null)} />
          <div role="radiogroup" aria-label="What happened" className="grid grid-cols-3 gap-2">
            {(Object.keys(STOCK_KIND) as StockKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  kind === k ? "border-brand bg-brand-soft font-medium text-link" : "border-line hover:bg-subtle",
                )}
                data-cy={`stock-kind-${k}`}
              >
                {STOCK_KIND[k]}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={kind === "adjustment" ? `Actual amount now (${material.unit})` : `Quantity (${material.unit})`}
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-cy="stock-quantity"
                />
              )}
            </Field>
            {kind === "purchase" && (
              <Field label={`Cost per ${material.unit} (${currency})`}>
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    data-cy="stock-cost"
                  />
                )}
              </Field>
            )}
            {kind === "usage" && (
              <Field label="For order (optional)">
                {(p) => (
                  <Select {...p} value={orderId} onChange={(e) => setOrderId(e.target.value)} data-cy="stock-order">
                    <option value="">No order</option>
                    {(orders.data?.data ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} · {o.customerName}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>
          <Field label="Note (optional)">
            {(p) => (
              <Input
                {...p}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                data-cy="stock-note"
              />
            )}
          </Field>
        </div>
      )}
      <h3 className="mt-6 mb-2 text-sm font-semibold text-fg">History</h3>
      <QueryState query={history}>
        {({ data }) =>
          data.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {data.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-fg">
                      {STOCK_KIND[m.kind]}
                      {m.orderNumber && <span className="text-fg-subtle"> · {m.orderNumber}</span>}
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {formatDateTime(m.createdAt, timeZone)}
                      {m.note && ` · ${m.note}`}
                    </p>
                  </div>
                  <span className={cn("tabular-nums", m.change < 0 ? "text-danger-fg" : "text-success-fg")}>
                    {m.change > 0 ? "+" : ""}
                    {m.change}
                  </span>
                  <span className="w-16 text-right text-xs text-fg-muted tabular-nums">= {m.balanceAfter}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-subtle">Nothing recorded yet.</p>
          )
        }
      </QueryState>
    </Modal>
  );
}
