import { useState } from "react";
import type { MeasurementTemplate } from "../../types/customer.types";
import { Button } from "../shared/Button";
import { Input } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { MAX_TEMPLATE_FIELDS, type TemplateProposal } from "./templatePlan";

interface Props {
  proposals: TemplateProposal[];
  templates: MeasurementTemplate[];
  saving: boolean;
  /** Save the chosen template changes, then the records. */
  onYes: (chosen: TemplateProposal[]) => void;
  /** Save the records only. */
  onNo: () => void;
  /** Go back: nothing is saved. */
  onClose: () => void;
}

/** Asked at Save time: should the new measurement names go into the business's templates too? */
export function TemplateOfferDialog({ proposals, templates, saving, onYes, onNo, onClose }: Props) {
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(proposals.map((p) => [p.key, p.name])),
  );
  const chosen = proposals.filter((p) => !skipped.has(p.key)).map((p) => ({ ...p, name: names[p.key] ?? p.name }));
  const ready = chosen.length > 0 && chosen.every((p) => p.templateId !== null || p.name.trim().length >= 2);

  const toggle = (key: string) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title="Save these measurements in your templates too?"
      description="A template lists what you measure for a kind of garment. Add these and they're ready next time. Each customer's measurements are saved either way."
      footer={
        <>
          <Button variant="secondary" onClick={onNo} disabled={saving} data-cy="template-offer-no">
            No, just the customers
          </Button>
          <Button onClick={() => onYes(chosen)} loading={saving} disabled={!ready} data-cy="template-offer-yes">
            Yes, save to templates
          </Button>
        </>
      }
    >
      <ul className="space-y-4">
        {proposals.map((p) => {
          const room = MAX_TEMPLATE_FIELDS - (templates.find((t) => t.id === p.templateId)?.fields.length ?? 0);
          const include = !skipped.has(p.key);
          return (
            <li key={p.key} className="rounded-lg border border-line p-3" data-cy="template-offer">
              <label className="flex items-center gap-2 text-sm font-medium text-fg">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={include}
                  disabled={saving}
                  onChange={() => toggle(p.key)}
                />
                {p.templateId ? `Add to the “${p.name}” template` : "Make a new template"}
              </label>
              {!p.templateId && include && (
                <Input
                  className="mt-2"
                  aria-label="Name of the new template"
                  placeholder="Name it, e.g. Gown or Kaftan"
                  value={names[p.key] ?? ""}
                  maxLength={100}
                  disabled={saving}
                  onChange={(e) => setNames((current) => ({ ...current, [p.key]: e.target.value }))}
                  data-cy="template-offer-name"
                />
              )}
              <p className="mt-2 text-xs text-fg-muted">{p.fields.join(", ")}</p>
              {p.fields.length > room && (
                <p className="mt-1 text-xs text-warning-fg">
                  A template holds {MAX_TEMPLATE_FIELDS} measurements, so only {Math.max(0, room)} of these fit.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
