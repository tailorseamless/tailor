import type { ISODate } from "./api.types";
import type { MeasurementUnit } from "./auth.types";

export type CustomerGender = "female" | "male" | "other";

/**
 * Where on the body a measurement is taken. `length` runs from the shoulder
 * down (gown, jacket, shirt…); `trouserLength` runs from the waist down.
 * Same list as the server's `BODY_LANDMARKS`.
 */
export type Landmark =
  | "neck"
  | "shoulder"
  | "bust"
  | "underbust"
  | "waist"
  | "hip"
  | "thigh"
  | "knee"
  | "calf"
  | "ankle"
  | "bicep"
  | "wrist"
  | "sleeve"
  | "length"
  | "trouserLength";

/** What a template field says about the figure: a spot, or `none` to keep it off. No setting at all means "by its name". */
export type FieldLandmark = Landmark | "none";

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
  /** Where on the body it is taken. Null: placed by the words in its name. */
  landmark: FieldLandmark | null;
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
  fields: { name: string; isRequired: boolean; landmark?: FieldLandmark | null }[];
}

export interface MeasurementValue {
  name: string;
  value: number;
  /** Where on the body, copied from the template field when it was taken. Absent: placed by its name. */
  landmark?: FieldLandmark;
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
  /** `customer` when the numbers were sent in by the customer, taken by another tailor. */
  source: "staff" | "customer";
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
