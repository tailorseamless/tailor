import { Search } from "lucide-react";
import { useState } from "react";
import { BusinessEditModal } from "../../components/admin/BusinessEditModal";
import { Button } from "../../components/shared/Button";
import { Badge, Card, FilterChips, PageHeader, Pagination, StatCard } from "../../components/shared/Display";
import { PromptDialog } from "../../components/shared/Modal";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useDebounce } from "../../hooks/useDebounce";
import { useAdminActions, useAdminBusinesses, useAdminOverview, useAdminUsers } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { AdminBusiness, AdminUser } from "../../types/workspace.types";
import { formatDate, relative } from "../../utils/formatDate";
import { ROLE } from "../../utils/labels";

type Pending =
  | { kind: "business"; item: AdminBusiness; status: AdminBusiness["status"] }
  | { kind: "user"; item: AdminUser; status: AdminUser["status"] };

/** Platform admin: every business and person on Tailor Seamless. */
export default function AdminPage() {
  const { timeZone, me } = useWorkspace();
  const overview = useAdminOverview();
  const [tab, setTab] = useState<"businesses" | "people">("businesses");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(term.trim(), 300);
  const businesses = useAdminBusinesses({ search: search || undefined, page });
  const users = useAdminUsers({ search: search || undefined, page });
  const { businessStatus, userStatus } = useAdminActions();
  const [pending, setPending] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<AdminBusiness | null>(null);

  const confirm = (reason: string) => {
    if (!pending) return;
    const done = { onSuccess: () => setPending(null) };
    if (pending.kind === "business")
      businessStatus.mutate({ id: pending.item.id, status: pending.status, reason }, done);
    else userStatus.mutate({ id: pending.item.id, status: pending.status, reason }, done);
  };
  const stopping = pending?.status === "suspended" || pending?.status === "disabled";

  return (
    <>
      <PageHeader title="Platform" subtitle="Every business and person on Tailor Seamless." />
      <QueryState query={overview}>
        {(o) => (
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Businesses"
              value={o.businesses.total}
              hint={`${o.businesses.newLast30Days} new in 30 days`}
            />
            <StatCard
              label="Active (30 days)"
              value={o.activity.activeBusinessesLast30Days}
              hint={`${o.activity.ordersLast30Days} orders`}
            />
            <StatCard label="People" value={o.users.total} hint={`${o.users.signedIn} have signed in`} />
            <StatCard
              label="Suspended"
              value={o.businesses.suspended}
              tone={o.businesses.suspended ? "warning" : "default"}
              hint={`${o.businesses.scheduledForDeletion} closing down`}
            />
          </div>
        )}
      </QueryState>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          label="Show"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={[
            { value: "businesses", label: "Businesses" },
            { value: "people", label: "People" },
          ]}
        />
        <div className="relative sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            type="search"
            className="control pl-9"
            placeholder={tab === "businesses" ? "Business or owner" : "Name or email"}
            aria-label="Search"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            data-cy="admin-search"
          />
        </div>
      </div>
      <Card>
        {tab === "businesses" ? (
          <QueryState query={businesses}>
            {({ data, meta }) =>
              data.length ? (
                <>
                  <ul className="divide-y divide-line">
                    {data.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-cy="admin-business">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">{b.name}</p>
                          <p className="text-xs text-fg-muted">
                            {b.owner ? `${b.owner.fullName} · ${b.owner.email}` : "No owner"} · since{" "}
                            {formatDate(b.createdAt, timeZone)}
                          </p>
                          <p className="text-xs text-fg-subtle">
                            {b.counts.members} staff · {b.counts.customers} customers · {b.counts.orders} orders
                            {b.lastOrderAt && ` · last order ${relative(b.lastOrderAt)}`}
                          </p>
                        </div>
                        {b.deletionScheduledFor && <Badge tone="warning">Closing</Badge>}
                        <Badge tone={b.status === "active" ? "success" : "danger"}>
                          {b.status === "active" ? "Active" : "Suspended"}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(b)} data-cy="admin-business-edit">
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={b.status === "active" ? "secondary" : "primary"}
                          onClick={() =>
                            setPending({
                              kind: "business",
                              item: b,
                              status: b.status === "active" ? "suspended" : "active",
                            })
                          }
                          data-cy="admin-business-toggle"
                        >
                          {b.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Pagination meta={meta} onPage={setPage} />
                </>
              ) : (
                <EmptyState title="No businesses match" />
              )
            }
          </QueryState>
        ) : (
          <QueryState query={users}>
            {({ data, meta }) =>
              data.length ? (
                <>
                  <ul className="divide-y divide-line">
                    {data.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-cy="admin-user">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">
                            {u.fullName}
                            {u.platformRole === "super_admin" && (
                              <span className="font-normal text-fg-subtle"> · platform admin</span>
                            )}
                          </p>
                          <p className="text-xs text-fg-muted">
                            {u.email} · {u.businessName}
                            {u.role && ` · ${ROLE[u.role].label}`}
                          </p>
                        </div>
                        {!u.hasSignedIn && <Badge tone="warning">Never signed in</Badge>}
                        <Badge tone={u.status === "active" ? "success" : "danger"}>
                          {u.status === "active" ? "Active" : "Disabled"}
                        </Badge>
                        {u.id !== me.user.id && (
                          <Button
                            size="sm"
                            variant={u.status === "active" ? "secondary" : "primary"}
                            onClick={() =>
                              setPending({
                                kind: "user",
                                item: u,
                                status: u.status === "active" ? "disabled" : "active",
                              })
                            }
                            data-cy="admin-user-toggle"
                          >
                            {u.status === "active" ? "Disable" : "Enable"}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Pagination meta={meta} onPage={setPage} />
                </>
              ) : (
                <EmptyState title="No people match" />
              )
            }
          </QueryState>
        )}
      </Card>
      {editing && <BusinessEditModal business={editing} onClose={() => setEditing(null)} />}
      <PromptDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onSubmit={confirm}
        title={
          pending
            ? `${pending.status === "suspended" ? "Suspend" : pending.status === "disabled" ? "Disable" : pending.kind === "business" ? "Reactivate" : "Enable"} ${pending.kind === "business" ? pending.item.name : pending.item.fullName}?`
            : ""
        }
        message={
          pending?.kind === "business"
            ? stopping
              ? "Nobody in this business can sign in until it's reactivated. Their data is kept."
              : "Everyone in the business can sign in again."
            : stopping
              ? "They can't sign in until enabled again."
              : "They can sign in again."
        }
        label="Reason (kept in the audit log)"
        confirmLabel={stopping ? "Yes, stop access" : "Yes, restore access"}
        danger={stopping}
        loading={businessStatus.isPending || userStatus.isPending}
      />
    </>
  );
}
