import type { CaptureGender, CaptureMatch, RecordCaptureDraft } from "../../types/ai.types";
import type { MeasurementTemplate } from "../../types/customer.types";

/**
 * The reviewed form of a Snap-a-record draft. Everything is editable text until it is saved; the AI's draft
 * only fills it in. Saving goes through the ordinary customer, measurement and order endpoints, one record
 * at a time, remembering what is already saved so a retry never makes a duplicate.
 */

export interface EditableValue {
  key: string;
  name: string;
  value: string;
  asWritten: string;
}

export interface EditableItem {
  key: string;
  garmentName: string;
  quantity: string;
  unitPrice: string;
  priceKnown: boolean;
  description: string;
}

export interface EditableOrder {
  key: string;
  include: boolean;
  items: EditableItem[];
  dueDate: string;
  notes: string;
  amountPaid: number | null;
  finished: boolean;
  /** One per order, kept across retries: the server then never creates it twice. */
  idempotencyKey: string;
  savedId: string | null;
  savedNumber: string | null;
}

export interface EditableMeasurement {
  include: boolean;
  templateId: string;
  /** No template fits: what to call a new one. */
  suggestedTemplate: string;
  unit: "in" | "cm";
  unitAssumed: boolean;
  measuredOn: string;
  notes: string;
  values: EditableValue[];
  savedId: string | null;
}

export interface EditableRecord {
  key: string;
  include: boolean;
  /** Add to an existing customer, or create a new one. */
  target: "new" | "existing";
  match: CaptureMatch | null;
  fullName: string;
  phone: string;
  phoneAsWritten: string | null;
  gender: CaptureGender | "";
  notes: string;
  measurement: EditableMeasurement | null;
  orders: EditableOrder[];
  /** Set once the customer exists (new or matched). */
  customerId: string | null;
  error: string | null;
  /** Another customer already has this phone number (the server's 409). */
  duplicateOf: string | null;
  /** The person said it's a different customer anyway (families share phones). */
  confirmDuplicate: boolean;
}

const uid = () => crypto.randomUUID();

export function toEditable(draft: RecordCaptureDraft): EditableRecord[] {
  return draft.records.map((r) => ({
    key: uid(),
    include: true,
    // A matching phone number is the same person; a matching name only might be.
    target: r.match?.by === "phone" ? "existing" : "new",
    match: r.match,
    fullName: r.customer.fullName,
    phone: r.customer.phone,
    phoneAsWritten: r.customer.phoneAsWritten,
    gender: r.customer.gender ?? "",
    notes: r.customer.notes ?? "",
    measurement: r.measurement && {
      include: true,
      templateId: r.measurement.templateId ?? "",
      suggestedTemplate: r.measurement.suggestedTemplate ?? "",
      unit: r.measurement.unit,
      unitAssumed: r.measurement.unitAssumed,
      measuredOn: r.measurement.measuredOn ?? "",
      notes: r.measurement.notes ?? "",
      values: r.measurement.values.map((v) => ({
        key: uid(),
        name: v.name,
        value: String(v.value),
        asWritten: v.asWritten,
      })),
      savedId: null,
    },
    orders: r.orders.map((o) => ({
      key: uid(),
      // A job the paper marks as collected or delivered is history: left out unless the person wants it.
      include: !o.finished,
      items: o.items.map((item) => ({
        key: uid(),
        garmentName: item.garmentName,
        quantity: String(item.quantity),
        unitPrice: item.priceKnown ? String(item.unitPrice) : "",
        priceKnown: item.priceKnown,
        description: item.description ?? "",
      })),
      dueDate: o.dueDate ?? "",
      notes: o.notes ?? "",
      amountPaid: o.amountPaid,
      finished: o.finished,
      idempotencyKey: crypto.randomUUID(),
      savedId: null,
      savedNumber: null,
    })),
    customerId: null,
    error: null,
    duplicateOf: null,
    confirmDuplicate: false,
  }));
}

const PHONE = /^\+?\d{7,15}$/;
export const cleanPhone = (value: string) => value.trim().replace(/[\s().-]/g, "");
export const toNumber = (value: string) => Number(value.trim().replace(",", "."));

/** How the server compares measurement and template names. */
export const nameKey = (name: string) => name.trim().toLowerCase();

/** The measurements a template insists on that these names don't include. */
export function missingRequired(template: MeasurementTemplate | undefined, names: string[]): string[] {
  if (!template) return [];
  const have = new Set(names.map(nameKey));
  return template.fields.filter((f) => f.isRequired && !have.has(nameKey(f.name))).map((f) => f.name);
}

/** What stops this record being saved, in words. Empty when it can be. */
export function problemsOf(record: EditableRecord, templates: MeasurementTemplate[]): string[] {
  const problems: string[] = [];
  if (record.target === "new") {
    if (record.fullName.trim().length < 2) problems.push("Enter the customer's name.");
    if (!PHONE.test(cleanPhone(record.phone))) problems.push("Enter the customer's phone number.");
  } else if (!record.match) {
    problems.push("Choose the customer.");
  }
  const m = record.measurement;
  if (m?.include && !m.savedId) {
    const filled = m.values.filter((v) => v.name.trim() || v.value.trim());
    if (!filled.length) problems.push("Add at least one measurement, or leave the measurements out.");
    if (filled.some((v) => !v.name.trim())) problems.push("Every measurement needs a name.");
    if (filled.some((v) => !(toNumber(v.value) > 0 && toNumber(v.value) <= 1000)))
      problems.push("Every measurement needs a number between 0 and 1000.");
    const names = filled.map((v) => nameKey(v.name));
    if (new Set(names).size !== names.length) problems.push("A measurement appears twice.");
    const template = templates.find((t) => t.id === m.templateId);
    const missing = missingRequired(template, names);
    if (missing.length) problems.push(`The ${template?.name} template needs: ${missing.join(", ")}.`);
  }
  for (const [i, o] of record.orders.entries()) {
    if (!o.include || o.savedId) continue;
    const label = record.orders.length > 1 ? `Order ${i + 1}` : "The order";
    if (!o.items.some((item) => item.garmentName.trim())) problems.push(`${label} needs at least one garment.`);
    if (
      o.items.some(
        (item) =>
          item.garmentName.trim() && !(Number.isInteger(toNumber(item.quantity)) && toNumber(item.quantity) >= 1),
      )
    )
      problems.push(`${label}: each garment needs a quantity of 1 or more.`);
    if (o.items.some((item) => item.unitPrice.trim() && !(toNumber(item.unitPrice) >= 0)))
      problems.push(`${label}: a price must be a number.`);
  }
  return problems;
}

/** Whether everything chosen in this record is already saved. */
export function isSaved(record: EditableRecord): boolean {
  if (!record.customerId) return false;
  if (record.measurement?.include && !record.measurement.savedId) return false;
  return record.orders.every((o) => !o.include || o.savedId);
}
