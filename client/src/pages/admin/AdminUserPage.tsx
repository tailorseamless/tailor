import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AuditLogPanel } from "../../components/admin/AuditLogPanel";
import { GUIDE_STEPS } from "../../components/onboarding/guideSteps";
import { Button } from "../../components/shared/Button";
import { Badge, Card, Detail, FilterChips, PageHeader } from "../../components/shared/Display";
import { PromptDialog } from "../../components/shared/Modal";
import { QueryState } from "../../components/shared/States";
import { useAdminActions, useAdminUserDetail } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import { formatDate, relative } from "../../utils/formatDate";
import { ROLE } from "../../utils/labels";

/** The server's minimum (`STOP_REASON_MIN`). */
const STOP_REASON_MIN = 10;

/** User 360: one person's account, what they did and what was done to their account. */
export default function AdminUserPage() {
  const { id } = useParams();
  const { timeZone, me, can } = useWorkspace();
  const manage = can("admin.manage");
  const audit = can("admin.audit");
  const detail = useAdminUserDetail(id);
  const { userStatus } = useAdminActions();
  const [history, setHistory] = useState<"by" | "about">("by");
  const [changingStatus, setChangingStatus] = useState(false);

  return (
    <QueryState query={detail}>
      {({ user: u, actions }) => {
        const disabling = u.status === "active";
        const platformLabel =
          u.adminBySetting || u.platformRole === "super_admin"
            ? "Super admin"
            : u.platformRole === "support"
              ? "Platform support"
              : null;
        return (
          <>
            <PageHeader
              back={{ to: "/admin", label: "Platform" }}
              title={u.fullName}
              subtitle={u.email}
              actions={
                manage && u.id !== me.user.id ? (
                  <Button variant={disabling ? "secondary" : "primary"} onClick={() => setChangingStatus(true)}>
                    {disabling ? "Disable" : "Enable"}
                  </Button>
                ) : undefined
              }
            />
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge tone={u.status === "active" ? "success" : "danger"}>
                {u.status === "active" ? "Active" : "Disabled"}
              </Badge>
              {platformLabel && <Badge tone="info">{platformLabel}</Badge>}
              {!u.hasSignedIn && <Badge tone="warning">Never signed in</Badge>}
              {u.memberStatus === "suspended" && <Badge tone="warning">Off the team</Badge>}
              {u.deletionScheduledFor && (
                <Badge tone="warning">Account closing on {formatDate(u.deletionScheduledFor, timeZone)}</Badge>
              )}
            </div>

            <Card className="mb-5">
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Business">
                  <Link to={`/admin/businesses/${u.businessId}`} className="hover:underline">
                    {u.businessName}
                  </Link>
                </Detail>
                <Detail label="Role">{u.role ? ROLE[u.role].label : "None"}</Detail>
                <Detail label="Joined">{formatDate(u.createdAt, timeZone)}</Detail>
                <Detail label="Last seen">
                  {u.lastSeenAt ? relative(u.lastSeenAt) : "Not since this was tracked"}
                </Detail>
                <Detail label="Time zone">{u.timeZone}</Detail>
                <Detail label="Actions recorded">
                  {actions.total} ({actions.last30Days} in 30 days)
                </Detail>
                <Detail label="Getting started">
                  {u.onboarding
                    ? `${u.onboarding.completed.length} of ${GUIDE_STEPS.length}${u.onboarding.dismissed ? " (closed)" : ""}`
                    : "Not started"}
                </Detail>
              </div>
            </Card>

            {audit && (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-fg">History</h2>
                  <FilterChips
                    label="Show"
                    value={history}
                    onChange={setHistory}
                    options={[
                      { value: "by", label: "What they did" },
                      { value: "about", label: "Done to their account" },
                    ]}
                  />
                </div>
                <AuditLogPanel
                  key={history}
                  fixed={history === "by" ? { actorId: u.id } : { entityType: "user", entityId: u.id }}
                />
              </>
            )}

            <PromptDialog
              key={`${u.id}-${u.status}-${changingStatus}`}
              open={changingStatus}
              onClose={() => setChangingStatus(false)}
              onSubmit={(reason) =>
                userStatus.mutate(
                  { id: u.id, status: disabling ? "disabled" : "active", reason },
                  { onSuccess: () => setChangingStatus(false) },
                )
              }
              title={`${disabling ? "Disable" : "Enable"} ${u.fullName}?`}
              message={disabling ? "They can't sign in until enabled again." : "They can sign in again."}
              label="Reason (kept in the audit log)"
              minLength={disabling ? STOP_REASON_MIN : undefined}
              confirmLabel={disabling ? "Yes, stop access" : "Yes, restore access"}
              danger={disabling}
              loading={userStatus.isPending}
            />
          </>
        );
      }}
    </QueryState>
  );
}
