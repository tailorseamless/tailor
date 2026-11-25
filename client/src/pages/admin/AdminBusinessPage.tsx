import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ActivityFeed } from "../../components/admin/ActivityFeed";
import { AdminNotesCard } from "../../components/admin/AdminNotesCard";
import { AuditLogPanel } from "../../components/admin/AuditLogPanel";
import { BusinessEditModal } from "../../components/admin/BusinessEditModal";
import { TrendBars } from "../../components/admin/TrendBars";
import { GUIDE_STEPS } from "../../components/onboarding/guideSteps";
import { Button } from "../../components/shared/Button";
import { Badge, Card, Detail, PageHeader, StatCard } from "../../components/shared/Display";
import { PromptDialog } from "../../components/shared/Modal";
import { QueryState } from "../../components/shared/States";
import { useAdminActions, useAdminBusinessDetail } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import { formatDate, relative } from "../../utils/formatDate";
import { ROLE } from "../../utils/labels";

/** The server's minimum (`STOP_REASON_MIN`). */
const STOP_REASON_MIN = 10;

/** Business 360: one business on one page. Counts and accounts only, never its customers or orders. */
export default function AdminBusinessPage() {
  const { id } = useParams();
  const { timeZone, can } = useWorkspace();
  const manage = can("admin.manage");
  const audit = can("admin.audit");
  const detail = useAdminBusinessDetail(id);
  const { businessStatus } = useAdminActions();
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  return (
    <>
      <QueryState query={detail}>
        {(d) => {
          const b = d.business;
          const suspending = b.status === "active";
          const done = d.onboarding?.completed ?? [];
          return (
            <>
              <PageHeader
                back={{ to: "/admin", label: "Platform" }}
                title={b.name}
                subtitle={`Since ${formatDate(b.createdAt, timeZone)} · ${b.currency} · ${b.timeZone}`}
                actions={
                  manage ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setEditing(true)}>
                        Edit
                      </Button>
                      <Button variant={suspending ? "secondary" : "primary"} onClick={() => setChangingStatus(true)}>
                        {suspending ? "Suspend" : "Reactivate"}
                      </Button>
                    </div>
                  ) : undefined
                }
              />
              <div className="mb-5 flex flex-wrap gap-2">
                <Badge tone={b.status === "active" ? "success" : "danger"}>
                  {b.status === "active" ? "Active" : "Suspended"}
                </Badge>
                {b.deletionScheduledFor && (
                  <Badge tone="warning">Closing on {formatDate(b.deletionScheduledFor, timeZone)}</Badge>
                )}
                {d.openAlerts > 0 && (
                  <Badge tone="warning">
                    {d.openAlerts} open alert{d.openAlerts === 1 ? "" : "s"}
                  </Badge>
                )}
                {d.publicPage.pageEnabled && <Badge tone="info">Public page live</Badge>}
                {d.publicPage.bookingEnabled && d.publicPage.pageEnabled && (
                  <Badge tone="info">Online booking on</Badge>
                )}
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Customers" value={d.counts.customers} />
                <StatCard
                  label="Open orders"
                  value={d.counts.ordersOpen}
                  hint={d.counts.ordersOverdue ? `${d.counts.ordersOverdue} overdue` : "None overdue"}
                  tone={d.counts.ordersOverdue ? "warning" : "default"}
                />
                <StatCard
                  label="Delivered orders"
                  value={d.counts.ordersDelivered}
                  hint={`${d.counts.ordersCancelled} cancelled`}
                />
                <StatCard
                  label="Last activity"
                  value={d.lastActivityAt ? relative(d.lastActivityAt) : "Never"}
                  hint={`${d.members.length} on the team`}
                />
              </div>

              <div className="mb-5 grid gap-5 lg:grid-cols-2">
                <Card>
                  <div className="space-y-3 p-4">
                    <p className="text-sm font-medium text-fg">Activity, last 12 weeks</p>
                    <TrendBars
                      points={d.activityByWeek.map((w) => ({ label: `Week of ${w.weekStart}`, value: w.events }))}
                      caption="Recorded actions per week, last 12 weeks"
                      valueLabel="actions"
                      height="h-20"
                    />
                  </div>
                </Card>
                <Card>
                  <div className="grid grid-cols-2 gap-3 p-4">
                    <Detail label="Owner">{b.owner ? `${b.owner.fullName} · ${b.owner.email}` : "No owner"}</Detail>
                    <Detail label="Contact">{[b.email, b.phone].filter(Boolean).join(" · ") || "None"}</Detail>
                    <Detail label="Payments recorded">{d.counts.payments}</Detail>
                    <Detail label="Upcoming appointments">{d.counts.appointmentsUpcoming}</Detail>
                    <Detail label="Requests waiting">{d.counts.requestsPending}</Detail>
                    <Detail label="Open tasks">{d.counts.tasksOpen}</Detail>
                    <Detail label="Designs · materials">
                      {d.counts.designs} · {d.counts.materials}
                    </Detail>
                    <Detail label="Expenses · branches">
                      {d.counts.expenses} · {d.counts.branches}
                    </Detail>
                    <Detail label="Emails, 30 days">
                      {d.email30d.sent} sent · {d.email30d.failed} failed · {d.email30d.pending} waiting
                    </Detail>
                    <Detail label="Getting started">
                      {d.onboarding
                        ? `${done.length} of ${GUIDE_STEPS.length}${d.onboarding.dismissed ? " (closed)" : ""}`
                        : "Not started"}
                    </Detail>
                  </div>
                  {d.onboarding && (
                    <ul className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
                      {GUIDE_STEPS.map(({ id: step, title }) => (
                        <li key={step}>
                          <Badge tone={done.includes(step) ? "success" : "neutral"}>
                            {done.includes(step) ? "✓ " : ""}
                            {title}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <Card className="mb-5">
                <div className="border-b border-line px-4 py-3">
                  <p className="text-sm font-medium text-fg">Team</p>
                </div>
                <ul className="divide-y divide-line">
                  {d.members.map((m) => (
                    <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3" data-cy="admin-member">
                      <div className="min-w-0 flex-1">
                        <Link to={`/admin/users/${m.userId}`} className="text-sm font-medium text-fg hover:underline">
                          {m.fullName}
                        </Link>
                        <p className="text-xs text-fg-muted">
                          {m.email} · {ROLE[m.role].label}
                          {m.lastSeenAt ? ` · seen ${relative(m.lastSeenAt)}` : ""}
                        </p>
                      </div>
                      {!m.hasSignedIn && <Badge tone="warning">Never signed in</Badge>}
                      {m.memberStatus === "suspended" && <Badge tone="warning">Off the team</Badge>}
                      {m.userStatus === "disabled" && <Badge tone="danger">Disabled</Badge>}
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="mb-5">
                <AdminNotesCard businessId={b.id} />
              </div>

              <h2 className="mb-3 text-base font-semibold text-fg">{audit ? "History" : "Activity"}</h2>
              {audit ? (
                <AuditLogPanel business={{ id: b.id, name: b.name }} />
              ) : (
                <Card>
                  <ActivityFeed businessId={b.id} limit={20} />
                </Card>
              )}

              {editing && <BusinessEditModal business={b} onClose={() => setEditing(false)} />}
              <PromptDialog
                key={`${b.id}-${b.status}-${changingStatus}`}
                open={changingStatus}
                onClose={() => setChangingStatus(false)}
                onSubmit={(reason) =>
                  businessStatus.mutate(
                    { id: b.id, status: suspending ? "suspended" : "active", reason },
                    { onSuccess: () => setChangingStatus(false) },
                  )
                }
                title={`${suspending ? "Suspend" : "Reactivate"} ${b.name}?`}
                message={
                  suspending
                    ? "Nobody in this business can sign in until it's reactivated. Their data is kept."
                    : "Everyone in the business can sign in again."
                }
                label="Reason (kept in the audit log)"
                minLength={suspending ? STOP_REASON_MIN : undefined}
                confirmText={suspending ? b.name : undefined}
                confirmLabel={suspending ? "Yes, stop access" : "Yes, restore access"}
                danger={suspending}
                loading={businessStatus.isPending}
              />
            </>
          );
        }}
      </QueryState>
    </>
  );
}
