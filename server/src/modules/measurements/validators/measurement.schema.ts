import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, isoDate, optionalText, trimmed, uuid } from "../../../shared/utils/zod";
import { MEASUREMENT_UNITS } from "../../businesses/dto/business.dto";
import { hasDuplicateNames } from "../domain/measurementValues";
import { FIELD_LANDMARKS, MEASUREMENT_LIMITS } from "../dto/measurement.dto";

// ── Templates ────────────────────────────────────────────────────────

const templateFields = z
  .array(
    z.object({
      name: trimmed(1, 80),
      isRequired: z.boolean().default(false),
      /** Where it sits on the figure; leave out (or null) to place it by its name. */
      landmark: z.enum(FIELD_LANDMARKS).nullable().optional(),
    }),
  )
  .min(1, "Add at least one measurement")
  .max(MEASUREMENT_LIMITS.maxFields)
  .refine((fields) => !hasDuplicateNames(fields), "Each measurement can only appear once");

export const listTemplatesSchema = z.object({
  query: z.object({ ...paginationQuery, search: z.string().trim().min(1).max(100).optional() }),
});

export const templateIdSchema = z.object({ params: idParams("id") });

export const createTemplateSchema = z.object({
  body: z.object({ name: trimmed(2, 100), description: optionalText(500), fields: templateFields }),
});

export const updateTemplateSchema = z.object({
  params: idParams("id"),
  body: z
    .object({ name: trimmed(2, 100), description: optionalText(500), fields: templateFields })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

// ── A customer's measurements ────────────────────────────────────────

/** A real calendar day, and not one that hasn't happened anywhere yet. */
const measuredOn = isoDate.refine((day) => {
  const time = Date.parse(`${day}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(day) && time <= Date.now() + 86_400_000;
}, "Enter a date that is not in the future");

const values = z
  .array(
    z.object({
      name: trimmed(1, 80),
      value: z
        .number()
        .positive()
        .max(MEASUREMENT_LIMITS.maxValue)
        .transform((value) => Math.round(value * 100) / 100),
    }),
  )
  .min(1, "Enter at least one measurement")
  .max(MEASUREMENT_LIMITS.maxValues)
  .refine((items) => !hasDuplicateNames(items), "Each measurement can only appear once");

export const measurementStatusSchema = z.object({});

export const listMeasurementsSchema = z.object({
  params: idParams("customerId"),
  query: z.object({ ...paginationQuery, templateId: uuid.optional() }),
});

export const measurementIdSchema = z.object({ params: idParams("customerId", "id") });

export const createMeasurementSchema = z.object({
  params: idParams("customerId"),
  body: z.object({
    /** Optional: measurements can be taken free-form, without a template. */
    templateId: uuid.nullable().optional(),
    /** Defaults to the business's unit. */
    unit: z.enum(MEASUREMENT_UNITS).optional(),
    /** Defaults to today where the person recording it is. */
    measuredOn: measuredOn.optional(),
    notes: optionalText(2000),
    values,
  }),
});

export type ListTemplatesQuery = z.infer<typeof listTemplatesSchema>["query"];
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>["body"];
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>["body"];
export type ListMeasurementsQuery = z.infer<typeof listMeasurementsSchema>["query"];
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>["body"];
