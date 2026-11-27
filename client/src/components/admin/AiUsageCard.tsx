import { useState } from "react";
import { Link } from "react-router-dom";
import { useAiUsage } from "../../hooks/useAi";
import { ERROR_KIND_LABEL, FEATURE_LABEL, providerLabel } from "../../types/ai.types";
import { Card, FilterChips, StatCard } from "../shared/Display";
import { QueryState } from "../shared/States";

const number = (n: number) => n.toLocaleString();

/** How AI is being used across the platform: requests, failures by kind, models, and the busiest businesses. */
export function AiUsageCard() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const usage = useAiUsage(Number(days));

  return (
    <Card
      title="Usage"
      action={
        <FilterChips
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      }
    >
      <QueryState query={usage}>
        {(u) => (
          <div className="space-y-5 p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Requests" value={number(u.totals.requests)} />
              <StatCard
                label="Failed"
                value={number(u.totals.failed)}
                tone={u.totals.requests && u.totals.failed / u.totals.requests > 0.2 ? "danger" : "default"}
                hint={u.totals.requests ? `${Math.round((u.totals.failed / u.totals.requests) * 100)}%` : undefined}
              />
              <StatCard
                label="Tokens"
                value={number(u.totals.inputTokens + u.totals.outputTokens)}
                hint={`${number(u.totals.inputTokens)} in · ${number(u.totals.outputTokens)} out`}
              />
              <StatCard
                label="Reached the daily allowance"
                value={number(u.businessesAtLimit)}
                hint="businesses, on at least one day"
              />
            </div>

            {u.totals.requests === 0 ? (
              <p className="text-sm text-fg-muted">No AI requests in this period.</p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <Table
                  title="By feature"
                  rows={u.byFeature.map((r) => [
                    FEATURE_LABEL[r.feature] ?? r.feature,
                    number(r.requests),
                    number(r.failed),
                  ])}
                  headings={["Feature", "Requests", "Failed"]}
                />
                <Table
                  title="By model"
                  rows={u.byModel.map((r) => [
                    `${providerLabel(r.provider)} · ${r.model}`,
                    number(r.requests),
                    number(r.inputTokens + r.outputTokens),
                  ])}
                  headings={["Model", "Requests", "Tokens"]}
                />
                {u.byError.length > 0 && (
                  <Table
                    title="Why requests failed"
                    rows={u.byError.map((r) => [ERROR_KIND_LABEL[r.errorKind] ?? r.errorKind, number(r.requests)])}
                    headings={["Reason", "Requests"]}
                  />
                )}
                {u.topBusinesses.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-fg">Busiest businesses</h3>
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {u.topBusinesses.map((b) => (
                        <li key={b.businessId} className="flex justify-between gap-3 px-3 py-2 text-sm">
                          <Link to={`/admin/businesses/${b.businessId}`} className="truncate text-link hover:underline">
                            {b.name}
                          </Link>
                          <span className="text-fg-muted">{number(b.requests)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </QueryState>
    </Card>
  );
}

function Table({ title, headings, rows }: { title: string; headings: string[]; rows: string[][] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-fg">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs text-fg-muted">
            <tr>
              {headings.map((h, i) => (
                <th key={h} scope="col" className={i === 0 ? "px-3 py-2" : "px-3 py-2 text-right"}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} className={i === 0 ? "px-3 py-2 text-fg" : "px-3 py-2 text-right text-fg-muted"}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
