import type { ISODate } from "./api.types";

export type MemberRole = "owner" | "manager" | "tailor" | "receptionist" | "accountant" | "apprentice";
export type AppRole = MemberRole | "admin";

/** The server's permission codes (`config/permissions.ts`). The UI shows or hides controls with them. */
export type Permission =
  | "profile.update"
  | "business.read"
  | "business.update"
  | "business.delete"
  | "branch.read"
  | "branch.manage"
  | "team.read"
  | "team.manage"
  | "customer.read"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "measurement.read"
  | "measurement.record"
  | "measurement.delete"
  | "measurement.template.manage"
  | "design.read"
  | "design.manage"
  | "order.read"
  | "order.create"
  | "order.update"
  | "order.status"
  | "payment.read"
  | "payment.record"
  | "payment.refund"
  | "payment.void"
  | "appointment.read"
  | "appointment.write"
  | "task.read"
  | "task.manage"
  | "task.status"
  | "inventory.read"
  | "inventory.stock"
  | "inventory.manage"
  | "expense.read"
  | "expense.manage"
  | "report.read"
  | "notification.read"
  | "email.read"
  | "admin.platform"
  | "dashboard.read";

export type MeasurementUnit = "in" | "cm";

export interface Business {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  timeZone: string;
  measurementUnit: MeasurementUnit;
  status: "active" | "suspended";
  emailCustomerReminders: boolean;
  emailReceipts: boolean;
  emailOrderUpdates: boolean;
  slug: string | null;
  /** The public page (designs, price ranges, contact details) is live at the slug. */
  pageEnabled: boolean;
  bookingEnabled: boolean;
  deletionScheduledFor: ISODate | null;
  createdAt: ISODate;
}

export interface Me {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    timeZone: string;
    platformRole: "user" | "super_admin";
    deletionScheduledFor: ISODate | null;
  };
  business: Business;
  roles: AppRole[];
  permissions: Permission[];
}

export interface RegisterInput {
  fullName: string;
  businessName: string;
  phone?: string;
  currency?: string;
  timeZone?: string;
}

export type BusinessInput = Partial<
  Pick<
    Business,
    | "name"
    | "phone"
    | "address"
    | "currency"
    | "timeZone"
    | "measurementUnit"
    | "emailCustomerReminders"
    | "emailReceipts"
    | "emailOrderUpdates"
    | "slug"
    | "pageEnabled"
    | "bookingEnabled"
  >
>;
