import { BranchFilter, useBranchFilter } from "../../components/shared/BranchFilter";
import { Plus, Scissors, Search } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { OrderRow } from "../../components/orders/OrderRow";
import { ButtonLink } from "../../components/shared/Button";
import { Card, FilterChips, PageHeader, Pagination } from "../../components/shared/Display";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useDebounce } from "../../hooks/useDebounce";
import { useOrders } from "../../hooks/useOrders";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { OrderFilters } from "../../types/order.types";

const filters = {
  all: { label: "All", params: {} },
  unfinished: { label: "In progress", params: { unfinished: true, sort: "due" } },
  ready: { label: "Ready", params: { status: "ready" } },
  overdue: { label: "Overdue", params: { overdue: true, sort: "due" } },
  unpaid: { label: "Owing", params: { unpaid: true } },
  delivered: { label: "Delivered", params: { status: "delivered" } },
} satisfies Record<string, { label: string; params: OrderFilters }>;
type FilterKey = keyof typeof filters;

export default function OrdersPage() {
  const { can } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const filter = (params.get("filter") ?? "unfinished") as FilterKey;
  const active = filters[filter] ? filter : "unfinished";
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(term.trim(), 300);
  const [branchId, setBranchId] = useBranchFilter();
  const query = useOrders({
    ...(filters[active].params as OrderFilters),
    branchId: branchId || undefined,
    search: search || undefined,
    page,
    limit: 20,
  });

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          can("order.create") && (
            <ButtonLink to="/orders/new" icon={<Plus className="size-4" aria-hidden />} data-cy="orders-new">
              New order
            </ButtonLink>
          )
        }
      />
      <div className="mb-4 space-y-3">
        <div className="relative sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            type="search"
            className="control pl-9"
            placeholder="Order number or customer"
            aria-label="Search orders"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            data-cy="orders-search"
          />
        </div>
        <BranchFilter value={branchId} onChange={setBranchId} />
        <FilterChips
          label="Show"
          value={active}
          onChange={(v) => {
            setParams({ filter: v }, { replace: true });
            setPage(1);
          }}
          options={(Object.keys(filters) as FilterKey[]).map((key) => ({ value: key, label: filters[key].label }))}
        />
      </div>
      <Card>
        <QueryState query={query} loadingLabel="Loading orders">
          {({ data, meta }) =>
            data.length ? (
              <>
                <ul className="divide-y divide-line">
                  {data.map((o) => (
                    <OrderRow key={o.id} order={o} />
                  ))}
                </ul>
                <Pagination meta={meta} onPage={setPage} />
              </>
            ) : (
              <EmptyState
                icon={<Scissors className="size-6" aria-hidden />}
                title={search ? "No orders match" : active === "all" ? "No orders yet" : "Nothing here right now"}
                message={
                  active === "all" && !search
                    ? "Orders you take in show up here with their status and balance."
                    : undefined
                }
              />
            )
          }
        </QueryState>
      </Card>
    </>
  );
}
