import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMeasurementTemplates, useRecordMeasurement } from "../../hooks/useCustomers";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Measurement, MeasurementTemplate } from "../../types/customer.types";
import type { MeasurementUnit } from "../../types/auth.types";
import { errorMessage } from "../../utils/errors";
import { todayIn } from "../../utils/timezone";
import { Button, IconButton } from "../shared/Button";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import { Modal } from "../shared/Modal";

interface Row {
  name: string;
  value: string;
  required: boolean;
}

const rowsFor = (template: MeasurementTemplate | undefined, previous?: Measurement): Row[] => {
  const prev = new Map(previous?.values.map((v) => [v.name.toLowerCase(), String(v.value)]));
  if (!template)
    return (previous?.values ?? []).map((v) => ({ name: v.name, value: String(v.value), required: false }));
  return [...template.fields]
    .sort((a, b) => a.position - b.position)
    .map((f) => ({ name: f.name, value: prev.get(f.name.toLowerCase()) ?? "", required: f.isRequired }));
};

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string;
  /** The latest set, so a re-measure starts from the old numbers. */
  previous?: Measurement;
}

export function MeasurementForm({ open, onClose, customerId, previous }: Props) {
  const { business, timeZone } = useWorkspace();
  const templates = useMeasurementTemplates();
  const record = useRecordMeasurement(customerId);
  const list = templates.data?.data ?? [];
  const [templateId, setTemplateId] = useState<string>(previous?.templateId ?? "");
  const [unit, setUnit] = useState<MeasurementUnit>(previous?.unit ?? business.measurementUnit);
  const [measuredOn, setMeasuredOn] = useState(todayIn(timeZone));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const template = list.find((t) => t.id === templateId);
  const current = rows ?? rowsFor(template, previous);

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows(current.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const close = () => {
    setRows(null);
    setProblem(null);
    setNotes("");
    record.reset();
    onClose();
  };

  const save = () => {
    setProblem(null);
    const filled = current.filter((r) => r.name.trim() && r.value.trim());
    const missing = current.find((r) => r.required && !r.value.trim());
    if (missing) return setProblem(`Enter ${missing.name}.`);
    const bad = filled.find((r) => !(Number(r.value) > 0 && Number(r.value) <= 1000));
    if (bad) return setProblem(`${bad.name} must be a number above 0.`);
    if (!filled.length) return setProblem("Enter at least one measurement.");
    record.mutate(
      {
        templateId: templateId || null,
        unit,
        measuredOn,
        notes: notes.trim() || null,
        values: filled.map((r) => ({ name: r.name.trim(), value: Number(r.value) })),
      },
      { onSuccess: close },
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record measurements"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} data-cy="measure-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={record.isPending} data-cy="measure-save">
            Save measurements
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (record.error ? errorMessage(record.error) : null)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Template">
            {(p) => (
              <Select
                {...p}
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setRows(null);
                }}
                data-cy="measure-template"
              >
                <option value="">No template</option>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Unit">
            {(p) => (
              <Select
                {...p}
                value={unit}
                onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
                data-cy="measure-unit"
              >
                <option value="in">Inches</option>
                <option value="cm">Centimetres</option>
              </Select>
            )}
          </Field>
          <Field label="Measured on">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={measuredOn}
                max={todayIn(timeZone)}
                onChange={(e) => setMeasuredOn(e.target.value)}
                data-cy="measure-date"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {current.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              {template && index < template.fields.length ? (
                <Field label={row.required ? `${row.name} *` : row.name} className="flex-1">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={row.value}
                      onChange={(e) => setRow(index, { value: e.target.value })}
                      data-cy="measure-value"
                    />
                  )}
                </Field>
              ) : (
                <>
                  <Input
                    aria-label="Measurement name"
                    placeholder="Name, e.g. Bust"
                    value={row.name}
                    onChange={(e) => setRow(index, { name: e.target.value })}
                    className="flex-1"
                    data-cy="measure-custom-name"
                  />
                  <Input
                    aria-label={`${row.name || "Measurement"} value`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={row.value}
                    onChange={(e) => setRow(index, { value: e.target.value })}
                    className="w-24"
                    data-cy="measure-custom-value"
                  />
                  <IconButton
                    label="Remove"
                    onClick={() => setRows(current.filter((_, i) => i !== index))}
                    data-cy="measure-remove"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </>
              )}
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => setRows([...current, { name: "", value: "", required: false }])}
          data-cy="measure-add"
        >
          Add a measurement
        </Button>
        <Field label="Notes (optional)">
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              data-cy="measure-notes"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
