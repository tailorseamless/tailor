import { Copy, Landmark } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import type { ShopPage } from "../../types/portal.types";
import { Button } from "../shared/Button";

/** Where to send a deposit or the balance: the bank details the business chose to show. */
export function ShopPayment({
  account,
  businessName,
}: {
  account: NonNullable<ShopPage["bankAccount"]>;
  businessName: string;
}) {
  const toast = useToast();
  const copy = () =>
    navigator.clipboard.writeText(account.accountNumber).then(
      () => toast.success("Account number copied"),
      () => toast.error("Couldn't copy it. Select the number and copy it by hand."),
    );

  return (
    <section
      aria-labelledby="shop-pay-title"
      className="mx-auto max-w-3xl rounded-xl border border-line bg-surface p-5"
      data-cy="shop-payment"
    >
      <h2 id="shop-pay-title" className="flex items-center gap-2 font-display text-xl font-semibold text-fg">
        <Landmark className="size-5 text-fg-muted" aria-hidden /> Pay by bank transfer
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-fg-subtle">Bank</dt>
          <dd className="mt-0.5 font-medium text-fg" data-cy="shop-bank-name">
            {account.bankName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Account number</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold tracking-wide text-fg tabular-nums" data-cy="shop-account-number">
              {account.accountNumber}
            </span>
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy className="size-4" aria-hidden />}
              onClick={() => void copy()}
              aria-label="Copy account number"
              data-cy="shop-account-copy"
            >
              Copy
            </Button>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-subtle">Account name</dt>
          <dd className="mt-0.5 font-medium text-fg" data-cy="shop-account-name">
            {account.accountName}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-fg-muted">
        Check that the account name matches before you send, and let {businessName} know once you've paid.
      </p>
    </section>
  );
}
