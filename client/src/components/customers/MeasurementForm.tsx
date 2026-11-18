import { Calculator, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMeasurementTemplates, useRecordMeasurement } from "../../hooks/useCustomers";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Measurement, MeasurementTemplate } from "../../types/customer.types";
import type { MeasurementUnit } from "../../types/auth.types";
import { landmarkFor, placeMeasurements, type Build } from "../../utils/bodyMap";
import { cn } from "../../utils/cn";
import { errorMessage } from "../../utils/errors";
import { parseMeasure } from "../../utils/measureInput";
import { todayIn } from "../../utils/timezone";
import { Button, IconButton } from "../shared/Button";
import { DatePicker } from "../shared/DatePicker";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { BodyDiagram } from "./BodyDiagram";
import { MeasureCalculator } from "./MeasureCalculator";

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
  /** Called with the saved set (e.g. so an order can pick it straight away). */
  onSaved?: (measurement: Measurement) => void;
  /** Which figure the live preview draws. */
  build?: Build;
}

export function MeasurementForm({ open, onClose, customerId, previous, onSaved, build }: Props) {
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
  /** The row being typed in, so its spot on the figure lights up. */
  const [focused, setFocused] = useState<number | null>(null);
  /** The calculator, and the box it fills: the one tapped last, which unlike `focused` stays after the tap moves on. */
  const [calculating, setCalculating] = useState(false);
  const [target, setTarget] = useState<number | null>(null);

  const template = list.find((t) => t.id === templateId);
  const current = rows ?? rowsFor(template, previous);

  const preview = placeMeasurements(
    current.flatMap((r) => {
      const value = parseMeasure(r.value);
      return r.name.trim() && value && value > 0 ? [{ name: r.name.trim(), value }] : [];
    }),
    unit,
    template?.name,
  );
  const focusedRow = focused === null ? undefined : current[focused];
  const active = focusedRow ? landmarkFor(focusedRow.name, template?.name) : null;
  const focusing = (index: number) => ({
    onFocus: () => {
      setFocused(index);
      setTarget(index);
    },
    onBlur: () => setFocused(null),
  });
  /** Rings the box the calculator will fill, so it is clear where "Use" goes. */
  const targeted = (index: number) => calculating && target === index && "ring-2 ring-focus/60";
  const targetRow = target === null ? undefined : current[target];

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows(current.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const close = () => {
    setRows(null);
    setProblem(null);
    setNotes("");
    setCalculating(false);
    setTarget(null);
    record.reset();
    onClose();
  };

  const save = () => {
    setProblem(null);
    const filled = current.filter((r) => r.name.trim() && r.value.trim());
    const missing = current.find((r) => r.required && !r.value.trim());
    if (missing) return setProblem(`Enter ${missing.name}.`);
    const parsed = filled.map((r) => ({ name: r.name.trim(), value: parseMeasure(r.value) }));
    const bad = parsed.find((r) => !(r.value !== null && r.value > 0 && r.value <= 1000));
    if (bad) return setProblem(`${bad.name} must be one number above 0, like 24.5 or 24 1/2.`);
    if (!filled.length) return setProblem("Enter at least one measurement.");
    record.mutate(
      {
        templateId: templateId || null,
        unit,
        measuredOn,
        notes: notes.trim() || null,
        values: parsed.map((r) => ({ name: r.name, value: r.value ?? 0 })),
      },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          close();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record measurements"
      size="lg"
      dock={
        calculating && (
          <MeasureCalculator
            unit={unit}
            target={targetRow ? targetRow.name.trim() : null}
            onUse={(value) => target !== null && setRow(target, { value })}
            onClose={() => setCalculating(false)}
          />
        )
      }
      footer={
        <>
          <Button
            variant="ghost"
            className="aria-pressed:bg-subtle aria-pressed:text-fg sm:mr-auto"
            icon={<Calculator className="size-4" aria-hidden />}
            aria-pressed={calculating}
            onClick={() => setCalculating(!calculating)}
            data-cy="measure-calculator"
          >
            Calculator
          </Button>
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
                  setTarget(null); // the boxes are different ones now
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
              <DatePicker
                {...p}
                value={measuredOn}
                onChange={setMeasuredOn}
                max={todayIn(timeZone)}
                timeZone={timeZone}
                clearable={false}
                data-cy="measure-date"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11.5rem]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {current.map((row, index) => {
                const fromTemplate = template && index < template.fields.length;
                return (
                  <div key={index} className={cn("flex items-end gap-2", !fromTemplate && "sm:col-span-2")}>
                    {fromTemplate ? (
                      <Field label={row.required ? `${row.name} *` : row.name} className="flex-1">
                        {(p) => (
                          <Input
                            {...p}
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.value}
                            onChange={(e) => setRow(index, { value: e.target.value })}
                            className={targeted(index) || undefined}
                            {...focusing(index)}
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
                          {...focusing(index)}
                          data-cy="measure-custom-name"
                        />
                        <Input
                          aria-label={`${row.name || "Measurement"} value`}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          value={row.value}
                          onChange={(e) => setRow(index, { value: e.target.value })}
                          className={cn("w-24", targeted(index))}
                          {...focusing(index)}
                          data-cy="measure-custom-value"
                        />
                        <IconButton
                          label="Remove"
                          onClick={() => {
                            setFocused(null);
                            setTarget(null); // the rows below move up
                            setRows(current.filter((_, i) => i !== index));
                          }}
                          data-cy="measure-remove"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      </>
                    )}
                  </div>
                );
              })}
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
          {/* A live picture of what is typed; hidden on phones, where the sheet needs the room. */}
          <div className="hidden sm:block" data-cy="measure-preview">
            <div className="sticky top-0">
              <BodyDiagram placed={preview} unit={unit} build={build} labels={false} active={active} />
              <p className="mt-1 text-center text-xs text-fg-subtle">Updates as you type</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
