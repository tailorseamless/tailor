import type { ISODate } from "./api.types";
import type { MeasurementUnit } from "./auth.types";

export type CustomerGender = "female" | "male" | "other";

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  gender: CustomerGender | null;
  notes: string | null;
  portalLinkCreatedAt: ISODate | null;
  createdAt: ISODate;
}

export interface CustomerInput {
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  gender?: CustomerGender | null;
  notes?: string | null;
  /** Save even though another customer has this phone number. */
  confirmDuplicate?: boolean;
}

export interface MeasurementField {
  id: string;
  name: string;
  position: number;
  isRequired: boolean;
}

export interface MeasurementTemplate {
  id: string;
  name: string;
  description: string | null;
  fields: MeasurementField[];
}

export interface TemplateInput {
  name: string;
  description?: string | null;
  fields: { name: string; isRequired: boolean }[];
}

export interface MeasurementValue {
  name: string;
  value: number;
}

export interface Measurement {
  id: string;
  customerId: string;
  templateId: string | null;
  templateName: string | null;
  unit: MeasurementUnit;
  measuredOn: string;
  notes: string | null;
  values: MeasurementValue[];
  createdAt: ISODate;
}

export interface MeasurementInput {
  templateId?: string | null;
  unit?: MeasurementUnit;
  measuredOn?: string;
  notes?: string | null;
  values: MeasurementValue[];
}

export interface PortalLink {
  url: string;
  createdAt: ISODate;
}
