import type { OrderItem } from "../../types/order.types";
import { formatMoney } from "../../utils/money";

/** "10% off" or the amount, for a line's discount. */
function discountLabel(item: OrderItem, money: (n: number) => string): string {
  if (item.discountType === "percent") return `${item.discountValue}% off`;
  return `${money(item.discountAmount)} off`;
}

/** The right-hand side of an item row: what it costs, how that was worked out, and any quote it started from. */
export function ItemPriceLine({ item, currency }: { item: OrderItem; currency: string }) {
  const money = (n: number) => formatMoney(n, currency);
  const quote =
    item.estimateMin !== null && item.estimateMax !== null
      ? `${money(item.estimateMin)} – ${money(item.estimateMax)} each`
      : null;

  if (item.pricePending) {
    return (
      <div className="text-right" data-cy="item-price-pending">
        <p className="text-sm font-medium text-warning-fg">Price to be agreed</p>
        {quote && <p className="text-xs text-fg-muted">Quoted {quote}</p>}
        {item.discountType && (
          <p className="text-xs text-fg-subtle">
            {item.discountType === "percent" ? `${item.discountValue}% off` : `${money(item.discountValue ?? 0)} off`}{" "}
            at the final price
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-sm font-medium text-fg tabular-nums" data-cy="item-line-total">
        {money(item.lineTotal)}
      </p>
      {(item.quantity > 1 || item.discountAmount > 0) && (
        <p className="text-xs text-fg-muted">
          {item.quantity} × {money(item.unitPrice)}
          {item.discountAmount > 0 && (
            <span data-cy="item-discount">
              , {discountLabel(item, money)} (−{money(item.discountAmount)})
            </span>
          )}
        </p>
      )}
      {quote && <p className="text-xs text-fg-subtle">Quoted {quote}</p>}
    </div>
  );
}
