import { useState } from "react";
import { useBranches } from "../../hooks/useTeam";
import { Field, Select } from "./Field";

const KEY = "tf-branch";

function readSaved(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The branch a person last looked at; remembered on this device across screens. */
export function useBranchFilter(): [string, (id: string) => void] {
  const [branchId, setBranchId] = useState(readSaved);
  const set = (id: string) => {
    setBranchId(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* not remembered: fine */
    }
  };
  return [branchId, set];
}

/** "All branches / Branch A / …". Hidden for businesses with one location. */
export function BranchFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const branches = useBranches().data?.data ?? [];
  if (!branches.length) return null;
  const known = !value || branches.some((b) => b.id === value);
  return (
    <select
      className="control w-auto"
      value={known ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Branch"
      data-cy="branch-filter"
    >
      <option value="">All branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
          {b.status === "archived" ? " (closed)" : ""}
        </option>
      ))}
    </select>
  );
}

/** The branch a new record belongs to, for forms. Hidden for businesses with one location. */
export function BranchField({
  value,
  onChange,
  dataCy,
}: {
  value: string;
  onChange: (id: string) => void;
  dataCy: string;
}) {
  const branches = useBranches().data?.data ?? [];
  const usable = branches.filter((b) => b.status === "active" || b.id === value);
  if (!usable.length) return null;
  return (
    <Field label="Branch">
      {(p) => (
        <Select {...p} value={value} onChange={(e) => onChange(e.target.value)} data-cy={dataCy}>
          <option value="">Whole business</option>
          {usable.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** The branch new records default to: the one this device last filtered by. */
export const defaultBranch = readSaved;
