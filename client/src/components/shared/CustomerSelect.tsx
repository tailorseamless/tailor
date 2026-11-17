import { Search, UserPlus, X } from "lucide-react";
import { useId, useState } from "react";
import { useCustomers } from "../../hooks/useCustomers";
import { useDebounce } from "../../hooks/useDebounce";
import { useWorkspace } from "../../hooks/useWorkspace";
import { cn } from "../../utils/cn";
import { CustomerForm } from "../customers/CustomerForm";

export interface PickedCustomer {
  id: string;
  fullName: string;
  phone?: string;
}

interface Props {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  error?: string;
  label?: string;
}

/** What was typed, as the start of a new customer: digits are a phone number, anything else a name. */
function startingValues(typed: string): { fullName?: string; phone?: string } {
  const text = typed.trim();
  if (!text) return {};
  const looksLikePhone = /^[+\d][\d\s().-]*$/.test(text) && text.replace(/\D/g, "").length >= 4;
  return looksLikePhone ? { phone: text } : { fullName: text };
}

/**
 * Search-as-you-type picker over the business's customers. When nobody matches (or the right
 * person isn't there yet), "Add a new customer" creates them on the spot and picks them.
 */
export function CustomerSelect({ value, onChange, error, label = "Customer" }: Props) {
  const id = useId();
  const { can } = useWorkspace();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<{ fullName?: string; phone?: string } | null>(null);
  const search = useDebounce(term.trim(), 250);
  const results = useCustomers(
    { search: search || undefined, limit: 8, sort: search ? "name" : "recent" },
    open && !value,
  );

  const pick = (customer: PickedCustomer) => {
    onChange(customer);
    setTerm("");
    setOpen(false);
  };

  // Rendered in both states, so the form isn't pulled away the moment the new customer is picked.
  const addForm = adding && (
    <CustomerForm
      open
      initial={adding}
      onClose={() => setAdding(null)}
      onSaved={(c) => pick({ id: c.id, fullName: c.fullName, phone: c.phone })}
      onUseExisting={pick}
    />
  );

  if (value) {
    return (
      <div className="space-y-1.5">
        {addForm}
        <span className="block text-sm font-medium text-fg">{label}</span>
        <div className="flex items-center justify-between rounded-lg border border-control bg-subtle px-3 py-2">
          <div>
            <p className="text-sm font-medium text-fg">{value.fullName}</p>
            {value.phone && <p className="text-xs text-fg-muted">{value.phone}</p>}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded p-1 text-fg-muted hover:bg-surface hover:text-fg"
            aria-label="Choose a different customer"
            data-cy="customer-clear"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const rows = results.data?.data ?? [];
  return (
    <div className="relative space-y-1.5">
      {addForm}
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
        <input
          id={id}
          className="control pl-9"
          placeholder="Search by name or phone"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-invalid={error ? true : undefined}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          role="combobox"
          autoComplete="off"
          data-cy="customer-search"
        />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-pop"
        >
          {results.isPending && <li className="px-3 py-2 text-sm text-fg-subtle">Searching…</li>}
          {!results.isPending && rows.length === 0 && (
            <li className="px-3 py-2 text-sm text-fg-subtle">No customers match.</li>
          )}
          {rows.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className={cn("w-full px-3 py-2 text-left hover:bg-subtle")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ id: c.id, fullName: c.fullName, phone: c.phone });
                  setTerm("");
                  setOpen(false);
                }}
                data-cy="customer-option"
              >
                <span className="block text-sm font-medium text-fg">{c.fullName}</span>
                <span className="block text-xs text-fg-muted">{c.phone}</span>
              </button>
            </li>
          ))}
          {!results.isPending && can("customer.create") && (
            <li role="presentation" className={cn(rows.length > 0 && "border-t border-line")}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-link hover:bg-subtle"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAdding(startingValues(term));
                  setOpen(false);
                }}
                data-cy="customer-add-new"
              >
                <UserPlus className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                  {term.trim() ? `Add "${term.trim()}" as a new customer` : "Add a new customer"}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
