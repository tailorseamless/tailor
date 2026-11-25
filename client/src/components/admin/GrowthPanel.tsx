import { Download } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAdminAdoption,
  useAdminChurnRisk,
  useAdminCohorts,
  useAdminDailyStats,
  useAdminExport,
} from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { AdminReportKind, Cohort, DailyStat } from "../../types/workspace.types";
import { Button } from "../shared/Button";
import { Badge, Card, FilterChips } from "../shared/Display";
import { EmptyState, QueryState } from "../shared/States";
import { TrendBars } from "./TrendBars";

interface Week {
  label: string;
  signups: number;
  activeBusinesses: number;
  activePeople: number;
  orders: number;
}

/**
 * Daily rows (UTC) folded into Monday-start weeks: new things are summed; the 7-day "active" counts
 * are read on the week's last day present (that is exactly the week's figure).
 */
function toWeeks(days: DailyStat[]): Week[] {
  const weeks = new Map<string, Week>();
  for (const d of days) {
    const date = new Date(`${d.day}T00:00:00Z`);
    const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    const week = weeks.get(monday) ?? {
      label: `Week of ${monday}`,
      signups: 0,
      activeBusinesses: 0,
      activePeople: 0,
      orders: 0,
    };
    week.signups += d.businessesNew;
    week.orders += d.ordersNew;
    week.activeBusinesses = d.businessesActive7d; // rows are in date order: the last one wins
    week.activePeople = d.peopleActive7d;
    weeks.set(monday, week);
  }
  return [...weeks.values()];
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

function retentionCell(cohort: Cohort, week: number) {
  const point = cohort.retention.find((r) => r.week === week);
  if (!point || point.eligible === 0) return <span className="text-fg-subtle">not yet</span>;
  return pct(point.retained, point.eligible);
}

const REPORTS: { kind: AdminReportKind; label: string; audit?: boolean }[] = [
  { kind: "churn-risk", label: "Churn risk, every business" },
  { kind: "businesses", label: "Businesses and their status" },
  { kind: "people", label: "People and their accounts" },
  { kind: "alerts", label: "Alerts and how they were resolved" },
  { kind: "daily-stats", label: "Daily platform figures" },
  { kind: "adoption", label: "Feature adoption" },
  { kind: "cohorts", label: "Sign-up cohorts" },
  { kind: "admin-actions", label: "Admin actions (audit)", audit: true },
];

/** Is the platform growing, and are businesses actually using it? */
export function GrowthPanel() {
  const { can } = useWorkspace();
  const [weeks, setWeeks] = useState<"12" | "26" | "52">("12");
  const days = Number(weeks) * 7;
  const stats = useAdminDailyStats(days);
  const adoption = useAdminAdoption(30);
  const cohorts = useAdminCohorts(Number(weeks));
  const exporter = useAdminExport();
  const churn = useAdminChurnRisk(35);

  return (
    <div className="space-y-5">
      <FilterChips
        label="Period"
        value={weeks}
        onChange={setWeeks}
        options={[
          { value: "12", label: "12 weeks" },
          { value: "26", label: "26 weeks" },
          { value: "52", label: "52 weeks" },
        ]}
      />

      <QueryState query={stats}>
        {(rows) => {
          const series = toWeeks(rows);
          if (!series.length)
            return (
              <Card>
                <EmptyState
                  title="No figures yet"
                  message="The daily figures are worked out every hour; the first run fills the last 90 days."
                />
              </Card>
            );
          return (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Businesses signing up, per week">
                <div className="p-4">
                  <TrendBars
                    points={series.map((w) => ({ label: w.label, value: w.signups }))}
                    caption="Businesses that signed up, per week"
                    valueLabel="sign-ups"
                  />
                </div>
              </Card>
              <Card title="Active businesses (someone did something that week)">
                <div className="p-4">
                  <TrendBars
                    points={series.map((w) => ({ label: w.label, value: w.activeBusinesses }))}
                    caption="Businesses where a person did anything in the week"
                    valueLabel="businesses"
                  />
                </div>
              </Card>
              <Card title="Active people, per week">
                <div className="p-4">
                  <TrendBars
                    points={series.map((w) => ({ label: w.label, value: w.activePeople }))}
                    caption="People who did anything in the week"
                    valueLabel="people"
                  />
                </div>
              </Card>
              <Card title="Orders taken, per week (all businesses)">
                <div className="p-4">
                  <TrendBars
                    points={series.map((w) => ({ label: w.label, value: w.orders }))}
                    caption="Orders created across the platform, per week"
                    valueLabel="orders"
                  />
                </div>
              </Card>
            </div>
          );
        }}
      </QueryState>

      <Card title="Businesses at risk of leaving">
        <QueryState query={churn}>
          {(list) =>
            list.length ? (
              <ul className="divide-y divide-line">
                {list.map((c) => (
                  <li key={c.businessId} className="flex flex-wrap items-start gap-3 px-4 py-3" data-cy="churn-risk">
                    <Badge tone={c.level === "high" ? "danger" : "warning"}>{c.score}</Badge>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/businesses/${c.businessId}`}
                        className="text-sm font-medium text-fg hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-fg-muted">{c.reasons.join(" · ")}</p>
                    </div>
                    {c.ownerEmail && <span className="text-xs text-fg-subtle">{c.ownerEmail}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No business looks at risk"
                message="Scores of 35 or more show here. Businesses under 2 weeks old are still settling in and left out."
              />
            )
          }
        </QueryState>
      </Card>

      <Card title="Feature adoption, last 30 days">
        <QueryState query={adoption}>
          {(a) =>
            a.activeBusinesses ? (
              <div className="space-y-2 p-4">
                <p className="text-xs text-fg-muted">
                  Of the {a.activeBusinesses} businesses where someone did something in the last {a.days} days.
                </p>
                <ul className="space-y-2">
                  {a.features.map((f) => (
                    <li key={f.key} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-sm">
                      <span className="text-fg">{f.label}</span>
                      <span className="h-2 rounded-full bg-subtle" aria-hidden>
                        <span
                          className="block h-2 rounded-full bg-brand"
                          style={{ width: `${(f.businesses / a.activeBusinesses) * 100}%` }}
                        />
                      </span>
                      <span className="text-right text-fg-muted">
                        {f.businesses} · {pct(f.businesses, a.activeBusinesses)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState title="No active businesses in the last 30 days" />
            )
          }
        </QueryState>
      </Card>

      <Card title="Sign-up cohorts">
        <QueryState query={cohorts}>
          {(list) =>
            list.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-fg-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Signed up the week of</th>
                      <th className="px-4 py-2 text-right font-medium">Businesses</th>
                      <th className="px-4 py-2 text-right font-medium">First order in 14 days</th>
                      <th className="px-4 py-2 text-right font-medium">Active week 2</th>
                      <th className="px-4 py-2 text-right font-medium">Week 4</th>
                      <th className="px-4 py-2 text-right font-medium">Week 12</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((c) => (
                      <tr key={c.weekStart}>
                        <td className="px-4 py-2 text-fg">{c.weekStart}</td>
                        <td className="px-4 py-2 text-right">{c.size}</td>
                        <td className="px-4 py-2 text-right">{pct(c.activated, c.size)}</td>
                        <td className="px-4 py-2 text-right">{retentionCell(c, 2)}</td>
                        <td className="px-4 py-2 text-right">{retentionCell(c, 4)}</td>
                        <td className="px-4 py-2 text-right">{retentionCell(c, 12)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-4 py-2 text-xs text-fg-subtle">
                  "Active week N" = someone in the business did something in days {"7N−6 to 7N"} after signing up.
                </p>
              </div>
            ) : (
              <EmptyState title="No sign-ups in this period" />
            )
          }
        </QueryState>
      </Card>

      <Card title="Reports">
        <ul className="divide-y divide-line">
          {REPORTS.filter((r) => !r.audit || can("admin.audit")).map((r) => (
            <li key={r.kind} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-sm text-fg">{r.label}</span>
              {(["csv", "xlsx"] as const).map((format) => (
                <Button
                  key={format}
                  size="sm"
                  variant="secondary"
                  disabled={exporter.isPending}
                  onClick={() => exporter.mutate({ kind: r.kind, format, days })}
                  data-cy={`admin-export-${r.kind}-${format}`}
                >
                  <Download className="size-4" aria-hidden /> {format === "csv" ? "CSV" : "Excel"}
                </Button>
              ))}
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-xs text-fg-subtle">
          Exports contain counts and account details only, and each one is recorded in the audit log.
        </p>
      </Card>
    </div>
  );
}
