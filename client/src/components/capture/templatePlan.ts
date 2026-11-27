import type { MeasurementTemplate } from "../../types/customer.types";
import { nameKey, type EditableRecord } from "./captureDraft";

/** server: MEASUREMENT_LIMITS.maxFields */
export const MAX_TEMPLATE_FIELDS = 40;

/** One change the person is asked about before saving. */
export interface TemplateProposal {
  key: string;
  /** Set when adding to a template that exists; null for a new one. */
  templateId: string | null;
  name: string;
  /** Measurement names the template doesn't have yet. */
  fields: string[];
  /** The records that will use this template. */
  recordKeys: string[];
}

/**
 * What the captured measurements would add to the business's templates: new names for a template a record uses,
 * or a new template (grouped by the suggested garment) for records that fit none. Empty when nothing is new.
 */
export function planTemplates(records: EditableRecord[], templates: MeasurementTemplate[]): TemplateProposal[] {
  const proposals = new Map<string, TemplateProposal>();
  for (const record of records) {
    const m = record.measurement;
    if (!record.include || !m || !m.include || m.savedId) continue;
    const names = m.values.filter((v) => v.name.trim() && v.value.trim()).map((v) => v.name.trim());
    const suggestion = m.suggestedTemplate.trim();
    // The template chosen for it, else one already called what the AI suggested.
    const target = m.templateId
      ? templates.find((t) => t.id === m.templateId)
      : templates.find((t) => suggestion && nameKey(t.name) === nameKey(suggestion));
    const have = new Set(target?.fields.map((f) => nameKey(f.name)));
    const missing = names.filter((name) => !have.has(nameKey(name)));
    if (!missing.length) continue;

    const key = target?.id ?? `new:${nameKey(suggestion)}`;
    const proposal = proposals.get(key) ?? {
      key,
      templateId: target?.id ?? null,
      name: target?.name ?? suggestion,
      fields: [],
      recordKeys: [],
    };
    for (const name of missing) {
      if (!proposal.fields.some((field) => nameKey(field) === nameKey(name))) proposal.fields.push(name);
    }
    proposal.recordKeys.push(record.key);
    proposals.set(key, proposal);
  }
  return [...proposals.values()];
}
