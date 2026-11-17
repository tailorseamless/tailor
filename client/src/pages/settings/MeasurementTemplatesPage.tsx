import { ArrowDown, ArrowUp, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "../../components/shared/Button";
import { Badge, Card, PageHeader } from "../../components/shared/Display";
import { Field, FormError, Input } from "../../components/shared/Field";
import { ConfirmDialog, Modal } from "../../components/shared/Modal";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useMeasurementTemplates, useTemplateActions } from "../../hooks/useCustomers";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { MeasurementTemplate } from "../../types/customer.types";
import { errorMessage } from "../../utils/errors";

/** The lists of measurements taken for each kind of garment. */
export default function MeasurementTemplatesPage() {
  const { can } = useWorkspace();
  const query = useMeasurementTemplates();
  const { remove } = useTemplateActions();
  const [editing, setEditing] = useState<MeasurementTemplate | "new" | null>(null);
  const [removing, setRemoving] = useState<MeasurementTemplate | null>(null);
  const canManage = can("measurement.template.manage");

  return (
    <>
      <PageHeader
        back={{ to: "/settings", label: "Settings" }}
        title="Measurement templates"
        subtitle="The measurements you take for each kind of garment. Pick one when measuring a customer."
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setEditing("new")}
              data-cy="template-new"
            >
              New template
            </Button>
          )
        }
      />
      <QueryState query={query} loadingLabel="Loading templates">
        {({ data }) =>
          data.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {data.map((t) => (
                <Card
                  key={t.id}
                  title={t.name}
                  action={
                    canManage && (
                      <div className="flex">
                        <IconButton label={`Edit ${t.name}`} onClick={() => setEditing(t)} data-cy="template-edit">
                          <Pencil className="size-4" aria-hidden />
                        </IconButton>
                        <IconButton label={`Delete ${t.name}`} onClick={() => setRemoving(t)} data-cy="template-delete">
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      </div>
                    )
                  }
                >
                  <div className="px-4 py-3">
                    {t.description && <p className="mb-2 text-sm text-fg-muted">{t.description}</p>}
                    <ul className="flex flex-wrap gap-1.5">
                      {[...t.fields]
                        .sort((a, b) => a.position - b.position)
                        .map((f) => (
                          <li key={f.id}>
                            <Badge tone={f.isRequired ? "brand" : "neutral"}>
                              {f.name}
                              {f.isRequired && " *"}
                            </Badge>
                          </li>
                        ))}
                    </ul>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<Ruler className="size-6" aria-hidden />}
                title="No templates yet"
                message="Make one for each garment you sew, e.g. Agbada, Gown, Trousers."
              />
            </Card>
          )
        }
      </QueryState>
      {editing && <TemplateForm template={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        title={`Delete ${removing?.name ?? ""}?`}
        message="Measurements already taken with it are kept."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </>
  );
}

interface Row {
  name: string;
  isRequired: boolean;
}

function TemplateForm({ template, onClose }: { template?: MeasurementTemplate; onClose: () => void }) {
  const { create, update } = useTemplateActions();
  const mutation = template ? update : create;
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [rows, setRows] = useState<Row[]>(
    template
      ? [...template.fields]
          .sort((a, b) => a.position - b.position)
          .map((f) => ({ name: f.name, isRequired: f.isRequired }))
      : ["Chest", "Waist", "Hip", "Shoulder", "Sleeve", "Length"].map((n) => ({ name: n, isRequired: false })),
  );
  const [problem, setProblem] = useState<string | null>(null);

  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) => {
    const next = [...rows];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setRows(next);
  };

  const save = () => {
    setProblem(null);
    const fields = rows.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name);
    if (name.trim().length < 2) return setProblem("Name the template.");
    if (!fields.length) return setProblem("Add at least one measurement.");
    const names = fields.map((f) => f.name.toLowerCase());
    if (new Set(names).size !== names.length) return setProblem("Each measurement can only appear once.");
    const input = { name: name.trim(), description: description.trim() || null, fields };
    if (template) update.mutate({ id: template.id, input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={template ? `Edit ${template.name}` : "New template"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="template-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={mutation.isPending} data-cy="template-save">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        <Field label="Name">
          {(p) => (
            <Input
              {...p}
              placeholder="e.g. Agbada"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-cy="template-name"
            />
          )}
        </Field>
        <Field label="Description (optional)">
          {(p) => (
            <Input
              {...p}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              data-cy="template-description"
            />
          )}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">Measurements, in the order you take them</legend>
          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li key={i} className="flex items-center gap-1">
                <Input
                  aria-label={`Measurement ${i + 1}`}
                  value={row.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  maxLength={80}
                  className="flex-1"
                  data-cy="template-field"
                />
                <label className="flex items-center gap-1 px-2 text-xs text-fg-muted">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={row.isRequired}
                    onChange={(e) => set(i, { isRequired: e.target.checked })}
                    data-cy="template-required"
                  />
                  Required
                </label>
                <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" aria-hidden />
                </IconButton>
                <IconButton label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label="Remove"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  data-cy="template-field-remove"
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
          {rows.length < 40 && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setRows([...rows, { name: "", isRequired: false }])}
              data-cy="template-field-add"
            >
              Add a measurement
            </Button>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}
