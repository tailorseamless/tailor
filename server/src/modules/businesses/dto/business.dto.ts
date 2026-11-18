import type { MemberRole } from "../../../config/permissions";

export const BUSINESS_STATUSES = ["active", "suspended"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const MEASUREMENT_UNITS = ["in", "cm"] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const MEMBER_STATUSES = ["active", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** A fashion business — the tenant every other record belongs to. */
export interface BusinessRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** ISO 4217, e.g. NGN. */
  currency: string;
  /** IANA zone used for "today", due dates and reminders. */
  timeZone: string;
  measurementUnit: MeasurementUnit;
  status: BusinessStatus;
  emailCustomerReminders: boolean;
  emailReceipts: boolean;
  emailOrderUpdates: boolean;
  /** The address of the public page: <APP_URL>/<slug>. */
  slug: string | null;
  /** The public page is live. */
  pageEnabled: boolean;
  /** Customers can request appointments on the public page. */
  bookingEnabled: boolean;
  /** Where customers pay, shown on the public page. Either all three are set or none. */
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  /** Set while a deletion is pending; cancel before then to keep the business. */
  deletionScheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberRecord {
  id: string;
  businessId: string;
  userId: string;
  branchId: string | null;
  role: MemberRole;
  status: MemberStatus;
  createdAt: Date;
}
