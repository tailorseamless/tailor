import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  cleanPhone,
  isSaved,
  nameKey,
  problemsOf,
  toNumber,
  type EditableOrder,
  type EditableRecord,
} from "../components/capture/captureDraft";
import { MAX_TEMPLATE_FIELDS, type TemplateProposal } from "../components/capture/templatePlan";
import { customerEndpoints, measurementEndpoints } from "../endpoints/customer.endpoints";
import { orderEndpoints } from "../endpoints/order.endpoints";
import { ApiError } from "../transport/http";
import type { MeasurementTemplate } from "../types/customer.types";
import { errorMessage } from "../utils/errors";
import { formatMoney } from "../utils/money";
import { keys } from "./queryKeys";
import { useApiMutation } from "./useApi";

/**
 * Saving a reviewed Snap-a-record draft through the ordinary customer, measurement and order endpoints, one
 * record at a time. What is already saved is remembered on the record, so a retry never makes a duplicate.
 */

/** Looks up the customer the server says already has a phone number, to add the record to them. */
export function useCustomerLookup() {
  return useApiMutation((id: string) => customerEndpoints.get(id), { toastError: false });
}

/**
 * Adds the new measurement names to their templates (or makes new templates), and says which template each
 * record should now use. Updating a template REPLACES its list, so what is there goes back as it was.
 */
export function useSaveTemplates() {
  const client = useQueryClient();
  return useApiMutation(async (proposals: TemplateProposal[]) => {
    const assigned = new Map<string, MeasurementTemplate>(); // record key → template
    try {
      const existing = (await measurementEndpoints.templates()).data;
      for (const proposal of proposals) {
        const name = proposal.name.trim();
        let template = proposal.templateId
          ? existing.find((t) => t.id === proposal.templateId)
          : existing.find((t) => nameKey(t.name) === nameKey(name));
        if (template) {
          const have = new Set(template.fields.map((f) => nameKey(f.name)));
          const added = proposal.fields
            .filter((f) => !have.has(nameKey(f)))
            .slice(0, Math.max(0, MAX_TEMPLATE_FIELDS - template.fields.length));
          if (added.length) {
            const updated = await measurementEndpoints.updateTemplate(template.id, {
              fields: [
                ...[...template.fields]
                  .sort((a, b) => a.position - b.position)
                  .map((f) => ({ name: f.name, isRequired: f.isRequired, landmark: f.landmark })),
                ...added.map((field) => ({ name: field, isRequired: false })),
              ],
            });
            existing.splice(existing.indexOf(template), 1, updated);
            template = updated;
          }
        } else {
          template = await measurementEndpoints.createTemplate({
            name,
            fields: proposal.fields.slice(0, MAX_TEMPLATE_FIELDS).map((field) => ({ name: field, isRequired: false })),
          });
          existing.push(template);
        }
        for (const key of proposal.recordKeys) assigned.set(key, template);
      }
    } finally {
      // Even a partial run changed something.
      await client.invalidateQueries({ queryKey: keys.measurements.templates });
    }
    return assigned;
  });
}

/** What was paid on paper isn't recorded as a payment (the method isn't known): it is noted on the order. */
function orderNotes(order: EditableOrder, currency: string): string | null {
  const parts = [order.notes.trim()];
  if (order.amountPaid)
    parts.push(`Paid on the paper record: ${formatMoney(order.amountPaid, currency)}. Record it as a payment.`);
  const text = parts.filter(Boolean).join("\n");
  return text ? text.slice(0, 2000) : null;
}

/** Saves one record step by step. Returns the record as it now stands (ids filled in, or an error). */
async function saveRecord(record: EditableRecord, currency: string): Promise<EditableRecord> {
  let next: EditableRecord = { ...record, error: null };
  try {
    if (!next.customerId) {
      if (next.target === "existing" && next.match) {
        next.customerId = next.match.id;
      } else {
        try {
          const customer = await customerEndpoints.create({
            fullName: next.fullName.trim(),
            phone: cleanPhone(next.phone),
            gender: next.gender || null,
            notes: next.notes.trim() || null,
            confirmDuplicate: next.confirmDuplicate || undefined,
          });
          next.customerId = customer.id;
          next.duplicateOf = null;
        } catch (err) {
          const duplicate =
            err instanceof ApiError && err.statusCode === 409 ? err.detail<{ customerId?: string }>() : null;
          if (duplicate?.customerId) {
            return {
              ...next,
              duplicateOf: duplicate.customerId,
              error:
                "Another customer already has this phone number. Add this to them, or save as a new customer anyway.",
            };
          }
          throw err;
        }
      }
    }
    const customerId = next.customerId as string;

    const m = next.measurement;
    if (m?.include && !m.savedId) {
      const saved = await measurementEndpoints.record(customerId, {
        templateId: m.templateId || null,
        unit: m.unit,
        measuredOn: m.measuredOn || undefined,
        notes: m.notes.trim() || null,
        values: m.values
          .filter((v) => v.name.trim() && v.value.trim())
          .map((v) => ({ name: v.name.trim(), value: toNumber(v.value) })),
      });
      next = { ...next, measurement: { ...m, savedId: saved.id } };
    }

    const orders: EditableOrder[] = [];
    for (const o of next.orders) {
      if (!o.include || o.savedId) {
        orders.push(o);
        continue;
      }
      const order = await orderEndpoints.create(
        {
          customerId,
          dueDate: o.dueDate || null,
          notes: orderNotes(o, currency),
          items: o.items
            .filter((item) => item.garmentName.trim())
            .map((item) => ({
              garmentName: item.garmentName.trim(),
              description: item.description.trim() || null,
              quantity: toNumber(item.quantity),
              // No price on the paper: 0 means "not agreed yet", as on the order form.
              unitPrice: item.unitPrice.trim() ? toNumber(item.unitPrice) : 0,
              fabricSource: "customer" as const,
              measurementId: next.measurement?.savedId ?? null,
            })),
        },
        o.idempotencyKey,
      );
      orders.push({ ...o, savedId: order.id, savedNumber: order.orderNumber });
      next = { ...next, orders: [...orders, ...next.orders.slice(orders.length)] };
    }
    return { ...next, orders };
  } catch (err) {
    return { ...next, error: errorMessage(err) };
  }
}

/** Saves every included record that isn't saved yet, in order, and refreshes the lists they appear in. */
export function useSaveCapture(currency: string) {
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const save = async (
    records: EditableRecord[],
    templates: MeasurementTemplate[],
    onRecord: (record: EditableRecord) => void,
  ): Promise<{ saved: number; failed: number }> => {
    setSaving(true);
    let saved = 0;
    let failed = 0;
    try {
      for (const record of records) {
        if (!record.include || isSaved(record) || problemsOf(record, templates).length) continue;
        const result = await saveRecord(record, currency);
        onRecord(result);
        if (result.error) failed += 1;
        else saved += 1;
      }
    } finally {
      await Promise.all(
        [keys.customers.all, keys.orders.all, ["measurements"], ["dashboard"]].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      );
      setSaving(false);
    }
    return { saved, failed };
  };
  return { save, saving };
}
