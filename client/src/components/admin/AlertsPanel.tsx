import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAlertActions, useAdminAlerts } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { AdminAlert, AlertSeverity, AlertStatus } from "../../types/workspace.types";
import { formatDateTime, relative } from "../../utils/formatDate";
import type { Tone } from "../../utils/statusLabels";
import { Button } from "../shared/Button";
import { Badge, Card, FilterChips, Pagination } from "../shared/Display";
import { PromptDialog } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";

const SEVERITY: Record<AlertSeverity, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "danger" },
  high: { label: "High", tone: "warning" },
  medium: { label: "Medium", tone: "info" },
  low: { label: "Low", tone: "neutral" },
};

const STATUS: Record<AlertStatus, string> = { open: "Open", acknowledged: "Acknowledged", resolved: "Resolved" };

function AlertRow({
  alert,
  timeZone,
  manage,
  onAcknowledge,
  onResolve,
  busy,
}: {
  alert: AdminAlert;
  timeZone: string;
  manage: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
  busy: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3" data-cy="admin-alert">
      <Badge tone={SEVERITY[alert.severity].tone}>{SEVERITY[alert.severity].label}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{alert.title}</p>
        {alert.detail && <p className="text-sm text-fg-muted">{alert.detail}</p>}
        <p className="text-xs text-fg-subtle">
          Raised {formatDateTime(alert.createdAt, timeZone)}
          {alert.occurrences > 1 && ` · seen ${alert.occurrences} times, last ${relative(alert.lastSeenAt)}`}
          {alert.business && (
            <>
              {" · "}
              <Link to={`/admin/businesses/${alert.business.id}`} className="hover:underline">
                {alert.business.name}
              </Link>
            </>
          )}
        </p>
        {alert.acknowledged && alert.status !== "resolved" && (
          <p className="text-xs text-fg-subtle">
            Acknowledged by {alert.acknowledged.by ?? "a former admin"} {relative(alert.acknowledged.at)}
          </p>
        )}
        {alert.resolved && (
          <p className="text-xs text-fg-subtle">
            {alert.resolved.by ? `Resolved by ${alert.resolved.by}` : "Cleared by itself"} {relative(alert.resolved.at)}
            {alert.resolved.note && alert.resolved.by && `: ${alert.resolved.note}`}
          </p>
        )}
      </div>
      {alert.status !== "open" && <Badge tone="neutral">{STATUS[alert.status]}</Badge>}
      {manage && alert.status === "open" && (
        <Button size="sm" variant="ghost" onClick={onAcknowledge} disabled={busy} data-cy="alert-acknowledge">
          Acknowledge
        </Button>
      )}
      {manage && alert.status !== "resolved" && (
        <Button size="sm" variant="secondary" onClick={onResolve} data-cy="alert-resolve">
          Resolve
        </Button>
      )}
    </li>
  );
}

/** What needs attention, most severe first. Super admins acknowledge and resolve; support looks. */
export function AlertsPanel() {
  const { timeZone, can } = useWorkspace();
  const manage = can("admin.manage");
  const [status, setStatus] = useState<AlertStatus | "active">("active");
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<AdminAlert | null>(null);
  const alerts = useAdminAlerts({ status, severity: severity === "all" ? undefined : severity, page });
  const { acknowledge, resolve } = useAdminAlertActions();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterChips
          label="Show"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "active", label: "Needs attention" },
            { value: "open", label: "Open" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "resolved", label: "Resolved" },
          ]}
        />
        <FilterChips
          label="Severity"
          value={severity}
          onChange={(v) => {
            setSeverity(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Any" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
      </div>
      <Card>
        <QueryState query={alerts}>
          {({ data, meta }) =>
            data.length ? (
              <>
                <ul className="divide-y divide-line">
                  {data.map((alert) => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      timeZone={timeZone}
                      manage={manage}
                      busy={acknowledge.isPending}
                      onAcknowledge={() => acknowledge.mutate(alert.id)}
                      onResolve={() => setResolving(alert)}
                    />
                  ))}
                </ul>
                <Pagination meta={meta} onPage={setPage} />
              </>
            ) : (
              <EmptyState
                title={status === "active" ? "Nothing needs attention" : "No alerts match"}
                message="Alerts are checked every 10 minutes."
              />
            )
          }
        </QueryState>
      </Card>
      <PromptDialog
        key={resolving?.id ?? "none"}
        open={resolving !== null}
        onClose={() => setResolving(null)}
        onSubmit={(note) =>
          resolving && resolve.mutate({ id: resolving.id, note }, { onSuccess: () => setResolving(null) })
        }
        title={resolving ? `Resolve: ${resolving.title}` : ""}
        message="If the condition is still true when the rules next run, a new alert will open."
        label="What was done (kept with the alert)"
        confirmLabel="Resolve"
        loading={resolve.isPending}
      />
    </div>
  );
}
