import { useAdminAdmins } from "../../hooks/useOperations";
import { Badge, Card } from "../shared/Display";
import { EmptyState, QueryState } from "../shared/States";

/**
 * Everyone with platform power and where it comes from. Changing it is deliberately not possible from
 * here: grants go through the admin:grant script (recorded in the audit log) or the server's
 * PLATFORM_ADMIN_EMAILS setting.
 */
export function AdminsPanel() {
  const admins = useAdminAdmins();
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">
        Support can look at everything here but change nothing. Super admins can also suspend, disable, edit and read
        the audit log. To change this list, use <code className="font-mono text-xs">admin:grant</code> or the server's{" "}
        <code className="font-mono text-xs">PLATFORM_ADMIN_EMAILS</code> setting.
      </p>
      <Card>
        <QueryState query={admins}>
          {(list) =>
            list.length ? (
              <ul className="divide-y divide-line">
                {list.map((a) => (
                  <li key={a.email} className="flex flex-wrap items-center gap-3 px-4 py-3" data-cy="platform-admin">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{a.user?.fullName ?? a.email}</p>
                      <p className="text-xs text-fg-muted">
                        {a.user ? `${a.email} · ${a.user.businessName}` : "No account uses this address yet"}
                      </p>
                    </div>
                    {a.sources.map((source) => (
                      <Badge key={source} tone="neutral">
                        {source === "database" ? "Granted" : "Server setting"}
                      </Badge>
                    ))}
                    {a.user && !a.user.hasSignedIn && <Badge tone="warning">Never signed in</Badge>}
                    {a.user?.status === "disabled" && <Badge tone="danger">Disabled</Badge>}
                    <Badge tone={a.role === "super_admin" ? "success" : "info"}>
                      {a.role === "super_admin" ? "Super admin" : "Support"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No platform admins" />
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
