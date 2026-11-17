import { Pencil, Plus, Store } from "lucide-react";
import { useState } from "react";
import { useBranchActions, useBranches } from "../../hooks/useTeam";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Branch } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { isPhone, orNull } from "../../utils/validation";
import { Button, IconButton } from "../shared/Button";
import { Badge, Card } from "../shared/Display";
import { Field, FormError, Input, Select } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";

export function BranchesCard() {
  const { can } = useWorkspace();
  const query = useBranches();
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const canManage = can("branch.manage");

  return (
    <Card
      title="Branches"
      action={
        canManage && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setEditing("new")}
            data-cy="branch-new"
          >
            Add
          </Button>
        )
      }
    >
      <QueryState query={query}>
        {({ data }) =>
          data.length ? (
            <ul className="divide-y divide-line">
              {data.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3" data-cy="branch-row">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{b.name}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {[b.address, b.phone].filter(Boolean).join(" · ") || "No address yet"}
                    </p>
                  </div>
                  {b.status === "archived" && <Badge>Closed</Badge>}
                  {canManage && (
                    <IconButton label={`Edit ${b.name}`} onClick={() => setEditing(b)} data-cy="branch-edit">
                      <Pencil className="size-4" aria-hidden />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Store className="size-6" aria-hidden />}
              title="One shop"
              message="Add branches if you work from more than one location. Orders, stock and staff can then be split by branch."
            />
          )
        }
      </QueryState>
      {editing && <BranchForm branch={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function BranchForm({ branch, onClose }: { branch?: Branch; onClose: () => void }) {
  const { create, update } = useBranchActions();
  const mutation = branch ? update : create;
  const [name, setName] = useState(branch?.name ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [status, setStatus] = useState<Branch["status"]>(branch?.status ?? "active");
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    setProblem(null);
    if (name.trim().length < 2) return setProblem("Name the branch.");
    if (phone.trim() && !isPhone(phone)) return setProblem("Enter a valid phone number.");
    const input = { name: name.trim(), address: orNull(address), phone: orNull(phone) };
    if (branch) update.mutate({ id: branch.id, input: { ...input, status } }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={branch ? "Edit branch" : "Add a branch"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="branch-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={mutation.isPending} data-cy="branch-save">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        <Field label="Name">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} data-cy="branch-name" />}
        </Field>
        <Field label="Address (optional)">
          {(p) => (
            <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} data-cy="branch-address" />
          )}
        </Field>
        <Field label="Phone (optional)">
          {(p) => (
            <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-cy="branch-phone" />
          )}
        </Field>
        {branch && (
          <Field label="Status" hint="Closed branches keep their history but can't take new work.">
            {(p) => (
              <Select
                {...p}
                value={status}
                onChange={(e) => setStatus(e.target.value as Branch["status"])}
                data-cy="branch-status"
              >
                <option value="active">Open</option>
                <option value="archived">Closed</option>
              </Select>
            )}
          </Field>
        )}
      </div>
    </Modal>
  );
}
