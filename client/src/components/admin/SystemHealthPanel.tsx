import { useAdminSystemHealth } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { DeliveryHealth, JobHealth } from "../../types/workspace.types";
import { relative } from "../../utils/formatDate";
import type { Tone } from "../../utils/statusLabels";
import { Badge, Card } from "../shared/Display";
import { QueryState } from "../shared/States";

/** What each background job does, in words. */
const JOB_LABEL: Record<string, string> = {
  sendAppointmentReminders: "Appointment reminders",
  deliverEmails: "Email delivery",
  deliverPush: "Push notifications",
  purgeIdempotencyKeys: "Clean-up: request keys",
  pruneDevices: "Clean-up: old devices",
  processAccountDeletions: "Account deletions",
  evaluateAdminAlerts: "Admin alerts",
  rollupPlatformStats: "Daily platform figures",
  purgeMonitoringData: "Clean-up: security counters",
};

/** The kinds of refusal the API counts (server: `SecurityEventKind`). */
const SECURITY_LABEL: Record<string, string> = {
  auth_failed: "Bad sign-in tokens",
  disabled_access: "Disabled accounts",
  forbidden: "Not allowed",
  rate_limited: "Too many requests",
  portal_token_invalid: "Unknown portal links",
};

function StatusTile({ label, tone, value, hint }: { label: string; tone: Tone; value: string; hint?: string }) {
  return (
    <Card>
      <div className="space-y-1 p-4">
        <p className="text-xs text-fg-muted">{label}</p>
        <Badge tone={tone}>{value}</Badge>
        {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
      </div>
    </Card>
  );
}

function deliveryTile(label: string, d: DeliveryHealth) {
  const attempts = d.last24h.sent + d.last24h.failed;
  const failing = attempts > 0 && d.last24h.failed / attempts > 0.1;
  const hint = `${d.last24h.sent} sent, ${d.last24h.failed} failed in 24 h · ${d.pending} waiting${
    d.oldestPendingAt ? ` (oldest ${relative(d.oldestPendingAt)})` : ""
  }`;
  if (!d.enabled) return <StatusTile label={label} tone="warning" value="Switched off" hint={hint} />;
  return (
    <StatusTile
      label={label}
      tone={failing ? "danger" : "success"}
      value={failing ? "Failing" : "Working"}
      hint={hint}
    />
  );
}

function jobTone(job: JobHealth): Tone {
  if (job.consecutiveFailures >= 3) return "danger";
  if (job.lastOutcome === "failed") return "warning";
  return "success";
}

/**
 * Is the application healthy? Database, background jobs, email and push. Refreshes every minute.
 * Error messages show only for admins with technical access; errors themselves are in Sentry.
 */
export function SystemHealthPanel() {
  const { can } = useWorkspace();
  const technical = can("admin.technical");
  const health = useAdminSystemHealth();
  return (
    <QueryState query={health}>
      {(h) => (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusTile
              label="Database"
              tone={h.database.ok ? (h.database.pendingMigrations ? "warning" : "success") : "danger"}
              value={
                h.database.ok ? (h.database.pendingMigrations ? "Migrations pending" : "Connected") : "Unreachable"
              }
              hint={`API up ${Math.round(h.api.uptimeSeconds / 3600)} h · ${h.api.environment}`}
            />
            {deliveryTile("Email", h.email)}
            {deliveryTile("Push", h.push)}
            <StatusTile
              label="Error monitoring"
              tone={h.errorMonitoring.enabled ? "success" : "warning"}
              value={h.errorMonitoring.enabled ? "Sentry on" : "Not set up"}
              hint={h.errorMonitoring.enabled ? "Errors are reported to Sentry." : "Set SENTRY_DSN to capture errors."}
            />
          </div>

          <Card>
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-medium text-fg">Background jobs</p>
              <p className="text-xs text-fg-muted">
                {h.jobs.inProcess ? "Run inside the API, every minute." : "Run by a separate worker."} Checked{" "}
                {relative(h.checkedAt)}.
              </p>
            </div>
            {h.jobs.list.length ? (
              <ul className="divide-y divide-line">
                {h.jobs.list.map((job) => (
                  <li key={job.name} className="flex flex-wrap items-start gap-3 px-4 py-3" data-cy="job-health">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">{JOB_LABEL[job.name] ?? job.name}</p>
                      <p className="text-xs text-fg-muted">
                        {job.lastFinishedAt ? `Last ran ${relative(job.lastFinishedAt)}` : "Not run yet"}
                        {job.lastDurationMs !== null && ` · ${job.lastDurationMs} ms`}
                        {job.lastSucceededAt &&
                          job.lastOutcome === "failed" &&
                          ` · last worked ${relative(job.lastSucceededAt)}`}
                      </p>
                      {technical && job.lastError && job.lastOutcome === "failed" && (
                        <p className="mt-1 font-mono text-xs break-all text-danger">{job.lastError}</p>
                      )}
                    </div>
                    <Badge tone={jobTone(job)}>
                      {job.lastOutcome === "failed"
                        ? job.consecutiveFailures > 1
                          ? `Failed ${job.consecutiveFailures}× in a row`
                          : "Failed"
                        : "OK"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-fg-muted">No job has reported yet.</p>
            )}
          </Card>

          <Card>
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-medium text-fg">Refused requests, last 24 hours</p>
              <p className="text-xs text-fg-muted">
                Bursts from one address raise a High alert.
                {technical ? "" : " The addresses are visible to technical admins."}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
              {Object.entries(SECURITY_LABEL).map(([kind, label]) => (
                <div key={kind}>
                  <dt className="text-xs text-fg-muted">{label}</dt>
                  <dd className="text-lg font-semibold text-fg">{(h.security.last24h[kind] ?? 0).toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            {technical && h.security.topSources.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {h.security.topSources.map((s) => (
                  <li key={`${s.kind}-${s.ip}`} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                    <span className="font-mono text-xs text-fg">{s.ip}</span>
                    <span className="flex-1 text-fg-muted">{SECURITY_LABEL[s.kind] ?? s.kind}</span>
                    <span className="text-fg">{s.count.toLocaleString()}</span>
                    <span className="text-xs text-fg-subtle">last {relative(s.lastAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {technical && h.email.recentFailures.length > 0 && (
            <Card>
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-medium text-fg">Latest emails that gave up</p>
                <p className="text-xs text-fg-muted">Kind and error only; addresses are not shown.</p>
              </div>
              <ul className="divide-y divide-line">
                {h.email.recentFailures.map((f) => (
                  <li key={f.id} className="px-4 py-3">
                    <p className="text-sm text-fg">
                      <span className="font-mono text-xs">{f.kind}</span>
                      <span className="text-fg-muted">
                        {" "}
                        · {f.attempts} attempts · {relative(f.updatedAt)}
                      </span>
                    </p>
                    {f.lastError && <p className="font-mono text-xs break-all text-fg-subtle">{f.lastError}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </QueryState>
  );
}
