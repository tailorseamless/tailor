import type { MeasurementUnit } from "../../businesses/dto/business.dto";

export const MEASUREMENT_LIMITS = {
  /** Fields in one template. */
  maxFields: 40,
  /** Values in one measurement record (template fields plus custom ones). */
  maxValues: 60,
  /** Largest sensible single measurement, in either unit. */
  maxValue: 1000,
} as const;

export interface MeasurementFieldRecord {
  id: string;
  name: string;
  position: number;
  isRequired: boolean;
}

/** A reusable list of what to measure for a kind of garment (Shirt, Gown, …). */
export interface MeasurementTemplateRecord {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeasurementTemplateDTO extends MeasurementTemplateRecord {
  fields: MeasurementFieldRecord[];
}

export interface TemplateFieldInput {
  name: string;
  isRequired: boolean;
}

/** One measured value. The name is copied in, so later template edits never change history. */
export interface MeasurementValue {
  name: string;
  value: number;
}

/** Who took the numbers: the business's own staff, or the customer (sent in, taken by another tailor). */
export const MEASUREMENT_SOURCES = ["staff", "customer"] as const;
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];

/**
 * One measuring session for a customer. Immutable: measuring again creates a
 * NEW record, so orders keep the version they were made from (PRD BR-006, BR-007).
 */
export interface CustomerMeasurementRecord {
  id: string;
  businessId: string;
  customerId: string;
  templateId: string | null;
  /** Snapshot of the template's name when it was recorded. */
  templateName: string | null;
  unit: MeasurementUnit;
  /** `YYYY-MM-DD` */
  measuredOn: string;
  notes: string | null;
  values: MeasurementValue[];
  source: MeasurementSource;
  recordedBy: string | null;
  createdAt: Date;
}

export interface ListTemplatesParams {
  businessId: string;
  page: number;
  limit: number;
  search?: string;
}

export interface ListMeasurementsParams {
  businessId: string;
  customerId: string;
  page: number;
  limit: number;
  templateId?: string;
}
