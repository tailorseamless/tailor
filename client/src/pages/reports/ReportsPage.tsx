import { BranchFilter, useBranchFilter } from "../../components/shared/BranchFilter";
import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/shared/Button";
import { Card, FilterChips, PageHeader, StatCard } from "../../components/shared/Display";
import { Input } from "../../components/shared/Field";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useExport, useGarmentSales, useIncomeExpenses } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { ExportKey, Period } from "../../types/workspace.types";
import { formatDay } from "../../utils/formatDate";
import { EXPENSE_CATEGORY } from "../../utils/labels";
import { formatMoney } from "../../utils/money";
import { todayIn } from "../../utils/timezone";

type Preset = "month" | "last" | "year" | "custom";

function periodFor(preset: Preset, today: string, custom: Period): Period {
  const [y, m] = today.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "last")
    return { from: iso(new Date(Date.UTC(y, m - 2, 1))), to: iso(new Date(Date.UTC(y, m - 1, 0))) };
  if (preset === "year") return { from: `${y}-01-01`, to: today };
  return custom;
}

const EXPORTS: { key: ExportKey; label: string }[] = [
  { key: "income-expenses", label: "Income and expenses" },
  { key: "garment-sales", label: "Garment sales" },
  { key: "orders", label: "Orders" },
  { key: "payments", label: "Payments" },
  { key: "expenses", label: "Expenses" },
];

const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-NG", { month: "short", year: "numeric", timeZone: "UTC" });

export default function ReportsPage() {
  const { timeZone } = useWorkspace();
  const today = todayIn(timeZone);
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState<Period>({ from: `${today.slice(0, 7)}-01`, to: today });
  const [branchId, setBranchId] = useBranchFilter();
  const period = { ...periodFor(preset, today, custom), branchId: branchId || undefined };
  const income = useIncomeExpenses(period);
  const garments = useGarmentSales(period);
  const exporter = useExport();

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={period.from && period.to ? `${formatDay(period.from)} – ${formatDay(period.to)}` : undefined}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <BranchFilter value={branchId} onChange={setBranchId} />
        <FilterChips
          label="Period"
          value={preset}
          onChange={setPreset}
          options={[
            { value: "month", label: "This month" },
            { value: "last", label: "Last month" },
            { value: "year", label: "This year" },
            { value: "custom", label: "Choose dates" },
          ]}
        />
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-auto"
              aria-label="From"
              value={custom.from}
              max={custom.to}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              data-cy="report-from"
            />
            <span className="text-fg-subtle">to</span>
            <Input
              type="date"
              className="w-auto"
              aria-label="To"
              value={custom.to}
              min={custom.from}
              max={today}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              data-cy="report-to"
            />
          </div>
        )}
      </div>

      <QueryState query={income} loadingLabel="Adding up the figures">
        {(r) => {
          const money = (n: number) => formatMoney(n, r.currency);
          const biggest = Math.max(1, ...r.expenses.byCategory.map((c) => c.total));
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="Money in"
                  value={money(r.netReceived)}
                  hint={r.refunded ? `After ${money(r.refunded)} refunded` : "Payments received"}
                />
                <StatCard label="Spent" value={money(r.expenses.total)} hint="Recorded expenses" />
                <StatCard
                  label="Profit (estimate)"
                  value={money(r.estimatedProfit)}
                  tone={r.estimatedProfit < 0 ? "danger" : "default"}
                  hint="Money in minus spent"
                />
                <StatCard label="Orders taken" value={money(r.orderValue)} hint="Value of new orders" />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Month by month">
                  {r.byMonth.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-fg-subtle">
                          <tr>
                            <th className="px-4 py-2 font-medium">Month</th>
                            <th className="px-4 py-2 text-right font-medium">In</th>
                            <th className="px-4 py-2 text-right font-medium">Spent</th>
                            <th className="px-4 py-2 text-right font-medium">Net</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line tabular-nums">
                          {r.byMonth.map((m) => (
                            <tr key={m.month}>
                              <td className="px-4 py-2 text-fg">{monthLabel(m.month)}</td>
                              <td className="px-4 py-2 text-right">{money(m.netReceived)}</td>
                              <td className="px-4 py-2 text-right">{money(m.expenses)}</td>
                              <td
                                className={`px-4 py-2 text-right font-medium ${m.net < 0 ? "text-danger-fg" : "text-fg"}`}
                              >
                                {money(m.net)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="Nothing in this period" />
                  )}
                </Card>
                <Card title="Where the money went">
                  {r.expenses.byCategory.length ? (
                    <ul className="space-y-3 p-4">
                      {r.expenses.byCategory.map((c) => (
                        <li key={c.category}>
                          <div className="flex justify-between text-sm">
                            <span className="text-fg">{EXPENSE_CATEGORY[c.category]}</span>
                            <span className="text-fg-muted tabular-nums">{money(c.total)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-subtle">
                            <div
                              className="h-2 rounded-full bg-brand"
                              style={{ width: `${(c.total / biggest) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No expenses recorded" />
                  )}
                </Card>
              </div>
            </div>
          );
        }}
      </QueryState>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Best-selling garments" className="lg:col-span-2">
          <QueryState query={garments}>
            {(g) =>
              g.garments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-fg-subtle">
                      <tr>
                        <th className="px-4 py-2 font-medium">Garment</th>
                        <th className="px-4 py-2 text-right font-medium">Made</th>
                        <th className="px-4 py-2 text-right font-medium">Orders</th>
                        <th className="px-4 py-2 text-right font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line tabular-nums">
                      {g.garments.map((row) => (
                        <tr key={row.garmentName}>
                          <td className="px-4 py-2 text-fg">{row.garmentName}</td>
                          <td className="px-4 py-2 text-right">{row.quantity}</td>
                          <td className="px-4 py-2 text-right">{row.orders}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatMoney(row.value, g.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No orders in this period" />
              )
            }
          </QueryState>
        </Card>
        <Card title="Download">
          <ul className="divide-y divide-line">
            {EXPORTS.map((x) => (
              <li key={x.key} className="flex items-center gap-2 px-4 py-2">
                <span className="flex-1 text-sm text-fg">{x.label}</span>
                {(["xlsx", "csv"] as const).map((format) => (
                  <Button
                    key={format}
                    size="sm"
                    variant="ghost"
                    icon={<Download className="size-4" aria-hidden />}
                    loading={
                      exporter.isPending && exporter.variables?.key === x.key && exporter.variables.format === format
                    }
                    onClick={() => exporter.mutate({ key: x.key, period, format })}
                    data-cy={`export-${x.key}-${format}`}
                  >
                    {format === "xlsx" ? "Excel" : "CSV"}
                  </Button>
                ))}
              </li>
            ))}
          </ul>
          <p className="px-4 pb-3 text-xs text-fg-subtle">Files cover the period chosen above (up to one year).</p>
        </Card>
      </div>
    </>
  );
}
