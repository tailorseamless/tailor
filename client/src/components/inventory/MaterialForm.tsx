import { useState } from "react";
import { useMaterialActions } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Material, MaterialCategory } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { keysOf, MATERIAL_CATEGORY } from "../../utils/labels";
import { orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { BranchField, defaultBranch } from "../shared/BranchFilter";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import { Modal } from "../shared/Modal";

const optionalNumber = (v: string) => (v.trim() === "" ? null : Number(v));

export function MaterialForm({ material, onClose }: { material?: Material; onClose: () => void }) {
  const { currency } = useWorkspace();
  const { create, update } = useMaterialActions();
  const mutation = material ? update : create;
  const [name, setName] = useState(material?.name ?? "");
  const [category, setCategory] = useState<MaterialCategory>(material?.category ?? "fabric");
  const [unit, setUnit] = useState(material?.unit ?? "yards");
  const [unitCost, setUnitCost] = useState(material?.unitCost?.toString() ?? "");
  const [minQuantity, setMinQuantity] = useState(material?.minQuantity?.toString() ?? "");
  const [opening, setOpening] = useState("");
  const [supplier, setSupplier] = useState(material?.supplier ?? "");
  const [notes, setNotes] = useState(material?.notes ?? "");
  const [branchId, setBranchId] = useState(material ? (material.branchId ?? "") : defaultBranch());
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    setProblem(null);
    if (name.trim().length < 2) return setProblem("Name the material.");
    if (!unit.trim()) return setProblem("Say how you count it (yards, metres, pieces…).");
    const numbers = [unitCost, minQuantity, opening].map(optionalNumber);
    if (numbers.some((n) => n !== null && !(n >= 0))) return setProblem("Amounts must be 0 or more.");
    const [cost, min, open] = numbers;
    const body = {
      name: name.trim(),
      category,
      unit: unit.trim(),
      unitCost: cost,
      minQuantity: min,
      supplier: orNull(supplier),
      notes: orNull(notes),
      branchId: branchId || null,
    };
    if (material) update.mutate({ id: material.id, input: body }, { onSuccess: onClose });
    else create.mutate({ ...body, ...(open !== null ? { openingQuantity: open } : {}) }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={material ? `Edit ${material.name}` : "Add a material"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="material-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={mutation.isPending} data-cy="material-save">
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
              placeholder="e.g. White lace, Black thread"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-cy="material-name"
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            {(p) => (
              <Select
                {...p}
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                data-cy="material-category"
              >
                {keysOf(MATERIAL_CATEGORY).map((c) => (
                  <option key={c} value={c}>
                    {MATERIAL_CATEGORY[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Counted in">
            {(p) => (
              <Input
                {...p}
                list="material-units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                data-cy="material-unit"
              />
            )}
          </Field>
          <datalist id="material-units">
            {["yards", "metres", "pieces", "rolls", "spools", "packs"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <Field label={`Cost per ${unit || "unit"} (${currency}, optional)`}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                data-cy="material-cost"
              />
            )}
          </Field>
          <Field label="Warn me below (optional)" hint="Shows as low stock under this amount.">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                data-cy="material-min"
              />
            )}
          </Field>
          {!material && (
            <Field label="In stock now (optional)">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  data-cy="material-opening"
                />
              )}
            </Field>
          )}
          <BranchField value={branchId} onChange={setBranchId} dataCy="material-branch" />
          <Field label="Supplier (optional)">
            {(p) => (
              <Input
                {...p}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                data-cy="material-supplier"
              />
            )}
          </Field>
        </div>
        <Field label="Notes (optional)">
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              data-cy="material-notes"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
