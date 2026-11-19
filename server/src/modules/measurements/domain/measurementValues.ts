import type { FieldLandmark, MeasurementValue } from "../dto/measurement.dto";

/** Pure rules for measurement values — no I/O (Backend Guide §2, §27.3). */

/** Names compare without regard to case or surrounding spaces: "Chest" = " chest ". */
export const nameKey = (name: string): string => name.trim().toLowerCase();

export function hasDuplicateNames(items: { name: string }[]): boolean {
  return new Set(items.map((item) => nameKey(item.name))).size !== items.length;
}

/**
 * Lines the given values up against a template: template fields first, in the
 * template's order and spelling; then any custom values, in the order given.
 * Reports required fields that were left out.
 *
 * Each value takes its field's spot on the body (`landmark`) with it, copied in like the name, so the figure for an
 * old record never changes when the template is edited later. Only what the template says is copied: a landmark in
 * `given` is ignored, and a field with no setting leaves the value without one (it is placed by its name).
 */
export function resolveValues(
  fields: { name: string; isRequired: boolean; landmark?: FieldLandmark | null }[],
  given: Pick<MeasurementValue, "name" | "value">[],
): { values: MeasurementValue[]; missing: string[] } {
  const remaining = new Map(given.map((value) => [nameKey(value.name), value]));
  const values: MeasurementValue[] = [];
  const missing: string[] = [];

  for (const field of fields) {
    const key = nameKey(field.name);
    const match = remaining.get(key);
    if (match) {
      values.push({ name: field.name, value: match.value, ...(field.landmark ? { landmark: field.landmark } : {}) });
      remaining.delete(key);
    } else if (field.isRequired) {
      missing.push(field.name);
    }
  }
  for (const extra of remaining.values()) values.push({ name: extra.name.trim(), value: extra.value });

  return { values, missing };
}
