export const CUSTOMER_GENDERS = ["female", "male", "other"] as const;
export type CustomerGender = (typeof CUSTOMER_GENDERS)[number];

export const CUSTOMER_SORTS = ["recent", "name"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

/** A customer of one business (PRD BR-002). */
export interface CustomerRecord {
  id: string;
  businessId: string;
  fullName: string;
  /** Stored without spaces or punctuation. */
  phone: string;
  email: string | null;
  address: string | null;
  gender: CustomerGender | null;
  notes: string | null;
  createdBy: string | null;
  /** When the current portal link was made; null = no link. */
  portalLinkCreatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListCustomersParams {
  businessId: string;
  page: number;
  limit: number;
  search?: string;
  sort: CustomerSort;
}
