import { BranchFilter, useBranchFilter } from "../../components/shared/BranchFilter";
import { Boxes, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { MaterialForm } from "../../components/inventory/MaterialForm";
import { StockModal } from "../../components/inventory/StockModal";
import { Button, IconButton } from "../../components/shared/Button";
import { Badge, Card, FilterChips, PageHeader, Pagination } from "../../components/shared/Display";
import { ConfirmDialog } from "../../components/shared/Modal";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useDebounce } from "../../hooks/useDebounce";
import { useMaterialActions, useMaterials } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Material } from "../../types/workspace.types";
import { MATERIAL_CATEGORY } from "../../utils/labels";
import { formatMoney } from "../../utils/money";

export default function InventoryPage() {
  const { can, currency } = useWorkspace();
  const [term, setTerm] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [stock, setStock] = useState<Material | null>(null);
  const [removing, setRemoving] = useState<Material | null>(null);
  const search = useDebounce(term.trim(), 300);
  const [branchId, setBranchId] = useBranchFilter();
  const query = useMaterials({
    search: search || undefined,
    lowStock: lowStock || undefined,
    branchId: branchId || undefined,
    page,
    limit: 30,
  });
  const { remove } = useMaterialActions();
  const canManage = can("inventory.manage");

  return (
    <>
      <PageHeader
        title="Materials"
        subtitle="Fabric, thread and trimmings you keep in stock."
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setEditing("new")}
              data-cy="material-new"
            >
              Add material
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
            placeholder="Search materials"
            aria-label="Search materials"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            data-cy="materials-search"
          />
        </div>
        <BranchFilter value={branchId} onChange={setBranchId} />
        <FilterChips
          label="Show"
          value={lowStock ? "low" : "all"}
          onChange={(v) => {
            setLowStock(v === "low");
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: "Running low" },
          ]}
        />
      </div>
      <Card>
        <QueryState query={query} loadingLabel="Loading materials">
          {({ data, meta }) =>
            data.length ? (
              <>
                <ul className="divide-y divide-line">
                  {data.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3" data-cy="material-row">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setStock(m)}
                        data-cy="material-open"
                      >
                        <p className="truncate text-sm font-medium text-fg">{m.name}</p>
                        <p className="text-xs text-fg-muted">
                          {MATERIAL_CATEGORY[m.category]}
                          {m.unitCost !== null && ` · ${formatMoney(m.unitCost, currency)} per ${m.unit}`}
                          {m.supplier && ` · ${m.supplier}`}
                        </p>
                      </button>
                      {m.isLowStock && <Badge tone="warning">Low</Badge>}
                      <span className="text-right text-sm font-semibold text-fg tabular-nums">
                        {m.quantity} <span className="font-normal text-fg-subtle">{m.unit}</span>
                      </span>
                      {canManage && (
                        <>
                          <IconButton label={`Edit ${m.name}`} onClick={() => setEditing(m)} data-cy="material-edit">
                            <Pencil className="size-4" aria-hidden />
                          </IconButton>
                          <IconButton
                            label={`Remove ${m.name}`}
                            onClick={() => setRemoving(m)}
                            data-cy="material-remove"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </IconButton>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <Pagination meta={meta} onPage={setPage} />
              </>
            ) : (
              <EmptyState
                icon={<Boxes className="size-6" aria-hidden />}
                title={search || lowStock ? "Nothing matches" : "No materials yet"}
                message="Track what you have, record what each order uses, and get warned before you run out."
              />
            )
          }
        </QueryState>
      </Card>
      {editing && <MaterialForm material={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {stock && <StockModal material={stock} onClose={() => setStock(null)} />}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        title={`Remove ${removing?.name ?? ""}?`}
        message="It disappears from your list. Its stock history is kept."
        confirmLabel="Remove"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
