import { ChevronDown, Plus, Ruler, Trash2 } from "lucide-react";
import type { MeasurementUnit } from "../../types/auth.types";
import type { MeasurementValue } from "../../types/customer.types";
import { cn } from "../../utils/cn";
import { parseMeasure } from "../../utils/measureInput";
import { Button, IconButton } from "../shared/Button";
import { Field, Input, Select } from "../shared/Field";

/** Rows the form starts with: the usual ones on a tailor's sheet. Rename them, or add your own. */
const STARTERS = ["Neck", "Chest", "Shoulder", "Sleeve length", "Waist", "Hip", "Length"];
const SUGGESTIONS = [
  ...STARTERS,
  "Bust",
  "Round sleeve",
  "Wrist",
  "Thigh",
  "Knee",
  "Calf",
  "Ankle",
  "Trouser length",
  "Gown length",
  "Jacket length",
];
const MAX_ROWS = 20;

export interface OwnMeasurements {
  open: boolean;
  unit: MeasurementUnit;
  rows: { name: string; value: string }[];
}

export const blankMeasurements = (unit: MeasurementUnit): OwnMeasurements => ({
  open: false,
  unit,
  rows: STARTERS.map((name) => ({ name, value: "" })),
});

/** What to send, or what to tell the person is wrong. A row with no number is just an unused row. */
export function measurementsToSend(own: OwnMeasurements): { values: MeasurementValue[] } | { problem: string } {
  const values: MeasurementValue[] = [];
  const seen = new Set<string>();
  for (const row of own.rows) {
    const name = row.name.trim();
    const text = row.value.trim();
    if (!text) continue;
    if (!name) return { problem: `Give the ${text} measurement a name.` };
    const value = parseMeasure(text);
    if (value === null || value <= 0 || value > 1000) {
      return { problem: `${name} must be one number, like 24.5 or 24 1/2.` };
    }
    if (seen.has(name.toLowerCase())) return { problem: `${name} is in your list twice.` };
    seen.add(name.toLowerCase());
    values.push({ name, value });
  }
  return { values };
}

/**
 * For customers who were measured by another tailor and want to send those numbers with their request. The
 * business checks them before keeping them, so this only asks for what is on the sheet.
 */
export function OwnMeasurementsForm({
  value,
  onChange,
}: {
  value: OwnMeasurements;
  onChange: (next: OwnMeasurements) => void;
}) {
  const filled = value.rows.filter((r) => r.value.trim()).length;
  const set = (patch: Partial<OwnMeasurements>) => onChange({ ...value, ...patch });
  const setRow = (index: number, patch: Partial<OwnMeasurements["rows"][number]>) =>
    set({ rows: value.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  return (
    <div className="rounded-lg border border-line" data-cy="own-measurements">
      <button
        type="button"
        aria-expanded={value.open}
        onClick={() => set({ open: !value.open })}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-fg"
        data-cy="own-measurements-toggle"
      >
        <Ruler className="size-4 shrink-0 text-fg-muted" aria-hidden />
        <span className="flex-1">
          Already measured by another tailor?
          {filled > 0 && <span className="font-normal text-fg-muted"> · {filled} added</span>}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-fg-muted transition-transform", value.open && "rotate-180")}
          aria-hidden
        />
      </button>

      {value.open && (
        <div className="space-y-3 border-t border-line p-3">
          <p className="text-sm text-fg-muted">
            Type the numbers from your sheet, one number in each box, like 24.5 or 24 1/2. We'll check them with you
            before we use them.
          </p>
          <Field label="Measured in" className="max-w-48">
            {(p) => (
              <Select
                {...p}
                value={value.unit}
                onChange={(e) => set({ unit: e.target.value as MeasurementUnit })}
                data-cy="own-unit"
              >
                <option value="in">Inches</option>
                <option value="cm">Centimetres</option>
              </Select>
            )}
          </Field>

          <ul className="space-y-2">
            {value.rows.map((row, index) => (
              <li key={index} className="flex items-center gap-2">
                <Input
                  aria-label="Measurement name"
                  list="own-measurement-names"
                  placeholder="Name, e.g. Thigh"
                  maxLength={60}
                  value={row.name}
                  onChange={(e) => setRow(index, { name: e.target.value })}
                  className="min-w-0 flex-1"
                  data-cy="own-name"
                />
                <Input
                  aria-label={`${row.name || "Measurement"} value`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={row.value}
                  onChange={(e) => setRow(index, { value: e.target.value })}
                  className="w-24 shrink-0"
                  data-cy="own-value"
                />
                <IconButton
                  label={`Remove ${row.name || "measurement"}`}
                  onClick={() => set({ rows: value.rows.filter((_, i) => i !== index) })}
                  data-cy="own-remove"
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
          <datalist id="own-measurement-names">
            {SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="size-4" aria-hidden />}
            disabled={value.rows.length >= MAX_ROWS}
            onClick={() => set({ rows: [...value.rows, { name: "", value: "" }] })}
            data-cy="own-add"
          >
            Add another
          </Button>
        </div>
      )}
    </div>
  );
}
