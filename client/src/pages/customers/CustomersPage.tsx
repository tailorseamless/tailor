import { Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CustomerForm } from "../../components/customers/CustomerForm";
import { Button } from "../../components/shared/Button";
import { Card, FilterChips, PageHeader, Pagination } from "../../components/shared/Display";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useCustomers } from "../../hooks/useCustomers";
import { useDebounce } from "../../hooks/useDebounce";
import { useWorkspace } from "../../hooks/useWorkspace";
import { relative } from "../../utils/formatDate";

export default function CustomersPage() {
  const { can } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const search = useDebounce(term.trim(), 300);
  const query = useCustomers({ search: search || undefined, sort, page, limit: 20 });
  const creating = params.get("new") === "1";

  const setCreating = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set("new", "1");
    else next.delete("new");
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Customers"
        actions={
          can("customer.create") && (
            <Button
              icon={<UserPlus className="size-4" aria-hidden />}
              onClick={() => setCreating(true)}
              data-cy="new-customer"
            >
              New customer
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            type="search"
            className="control pl-9"
            placeholder="Search name or phone"
            aria-label="Search customers"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            data-cy="customers-search"
          />
        </div>
        <FilterChips
          label="Sort"
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
          options={[
            { value: "recent", label: "Newest" },
            { value: "name", label: "A–Z" },
          ]}
        />
      </div>
      <Card>
        <QueryState query={query} loadingLabel="Loading customers">
          {({ data, meta }) =>
            data.length ? (
              <>
                <ul className="divide-y divide-line">
                  {data.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/customers/${c.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
                        data-cy="customer-row"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-link">
                          {c.fullName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{c.fullName}</p>
                          <p className="text-xs text-fg-muted">{c.phone}</p>
                        </div>
                        <span className="hidden text-xs text-fg-subtle sm:block">Added {relative(c.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Pagination meta={meta} onPage={setPage} />
              </>
            ) : (
              <EmptyState
                icon={<Users className="size-6" aria-hidden />}
                title={search ? "No customers match" : "No customers yet"}
                message={
                  search
                    ? "Try part of their name or phone number."
                    : "Add the people you sew for to keep their measurements and orders together."
                }
              />
            )
          }
        </QueryState>
      </Card>
      <CustomerForm
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => navigate(`/customers/${c.id}`)}
      />
    </>
  );
}
