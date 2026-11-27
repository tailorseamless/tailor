import { useState } from "react";
import { Link } from "react-router-dom";
import { useAiAdminActions, useAiBalances } from "../../hooks/useAi";
import { useDebounce } from "../../hooks/useDebounce";
import type { AiTokenBalance } from "../../types/ai.types";
import { errorMessage } from "../../utils/errors";
import { Button } from "../shared/Button";
import { Badge, Card, Pagination } from "../shared/Display";
import { Field, FormError, Input } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";

const MAX = 100_000_000;
const number = (n: number) => n.toLocaleString();

/** Every business's AI tokens, fewest first, with the way to give more. Support can look; super admins give. */
export function AiTokensCard({ manage }: { manage: boolean }) {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(term.trim(), 300);
  const balances = useAiBalances({ search: search || undefined, page });
  const [topUp, setTopUp] = useState<AiTokenBalance | null>(null);

  return (
    <Card title="Business tokens">
      <div className="px-4 pt-3">
        <input
          type="search"
          className="control sm:w-72"
          placeholder="Find a business"
          aria-label="Find a business"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(1);
          }}
          data-cy="ai-token-search"
        />
      </div>
      <QueryState query={balances}>
        {({ data, meta }) =>
          data.length ? (
            <>
              <ul className="divide-y divide-line">
                {data.map((b) => (
                  <li key={b.businessId} className="flex flex-wrap items-center gap-3 px-4 py-3" data-cy="ai-balance">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/businesses/${b.businessId}`}
                        className="text-sm font-medium text-fg hover:underline"
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-fg-muted">
                        {number(b.usedLast30Days)} used in 30 days
                        {!b.started && " · not used yet (has the starting amount)"}
                      </p>
                    </div>
                    {b.tokens === 0 ? (
                      <Badge tone="danger">Out of tokens</Badge>
                    ) : (
                      <span className="text-sm text-fg">{number(b.tokens)} tokens</span>
                    )}
                    {manage && (
                      <Button size="sm" variant="secondary" onClick={() => setTopUp(b)} data-cy="ai-give">
                        Give tokens
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination meta={meta} onPage={setPage} />
            </>
          ) : (
            <EmptyState title="No businesses found" message="Try another name." />
          )
        }
      </QueryState>
      {topUp && <GiveTokens business={topUp} onClose={() => setTopUp(null)} />}
    </Card>
  );
}

function GiveTokens({ business, onClose }: { business: AiTokenBalance; onClose: () => void }) {
  const { grant } = useAiAdminActions();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const parsed = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(parsed) && parsed !== 0 && Math.abs(parsed) <= MAX;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Give tokens to ${business.name}`}
      description={`They have ${number(business.tokens)} tokens now.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              grant.mutate(
                { businessId: business.businessId, amount: parsed, note: note.trim() },
                { onSuccess: onClose },
              )
            }
            loading={grant.isPending}
            disabled={!valid}
            data-cy="ai-give-save"
          >
            {valid && parsed < 0 ? "Take back" : "Give"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={grant.error ? errorMessage(grant.error) : null} />
        <div className="flex flex-wrap gap-2">
          {[50_000, 100_000, 500_000, 1_000_000].map((n) => (
            <Button key={n} size="sm" variant="secondary" onClick={() => setAmount(String(n))}>
              +{number(n)}
            </Button>
          ))}
        </div>
        <Field label="Tokens" hint="A minus number takes tokens back.">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-cy="ai-give-amount"
            />
          )}
        </Field>
        <Field label="Note (optional)" hint="Why, for your records.">
          {(p) => <Input {...p} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}

/** What each business has until it first spends or is given tokens. */
export function StartingTokensCard({ startingTokens }: { startingTokens: number }) {
  const { updateSettings } = useAiAdminActions();
  const [value, setValue] = useState(String(startingTokens));
  const [seen, setSeen] = useState(startingTokens);
  if (seen !== startingTokens) {
    // Saved elsewhere (or just now): show the stored amount.
    setSeen(startingTokens);
    setValue(String(startingTokens));
  }
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX;

  return (
    <Card title="Starting tokens">
      <div className="space-y-3 p-4">
        <p className="text-sm text-fg-muted">
          Each business gets this many tokens until it first uses AI or you give it some. Changing it doesn't change
          balances already started. Reading one page usually takes a few thousand tokens.
        </p>
        <Field label="Tokens for each business" error={valid ? undefined : `A whole number from 0 to ${number(MAX)}`}>
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              max={MAX}
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-cy="ai-starting-tokens"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => updateSettings.mutate(parsed)}
            loading={updateSettings.isPending}
            disabled={!valid || parsed === startingTokens}
            data-cy="ai-starting-tokens-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
