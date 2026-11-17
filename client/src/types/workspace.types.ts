import type { ISODate } from "./api.types";
import type { MemberRole } from "./auth.types";
import type { OrderImage } from "./order.types";
import type { PaymentMethod } from "./payment.types";

/* Team and branches */
export type AssignableRole = Exclude<MemberRole, "owner">;
export type MemberStatus = "active" | "suspended";

export interface TeamMember {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: MemberRole;
  status: MemberStatus;
  branchId: string | null;
  branchName: string | null;
  hasSignedIn: boolean;
  joinedAt: ISODate;
}

export interface TeamMemberInput {
  fullName: string;
  email: string;
  phone?: string | null;
  role: AssignableRole;
  branchId?: string | null;
}

export type TeamMemberUpdate = Partial<{
  fullName: string;
  phone: string | null;
  role: AssignableRole;
  status: MemberStatus;
  branchId: string | null;
}>;

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: "active" | "archived";
  createdAt: ISODate;
}

export type BranchInput = Partial<{
  name: string;
  address: string | null;
  phone: string | null;
  status: Branch["status"];
}>;

/* Designs */
export type DesignVisibility = "private" | "customers";

export interface Design {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  visibility: DesignVisibility;
  isFavourite: boolean;
  images: OrderImage[];
  coverUrl: string | null;
  createdAt: ISODate;
}

export type DesignInput = Partial<{
  name: string;
  description: string | null;
  category: string | null;
  visibility: DesignVisibility;
  isFavourite: boolean;
}>;

export interface DesignFilters {
  search?: string;
  category?: string;
  favourite?: boolean;
  page?: number;
  limit?: number;
}

/* Tasks */
export type TaskStage = "cutting" | "sewing" | "fitting" | "alterations" | "finishing" | "other";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export interface Task {
  id: string;
  orderId: string;
  title: string;
  stage: TaskStage;
  status: TaskStatus;
  assignedTo: string | null;
  dueDate: string | null;
  notes: string | null;
  completedAt: ISODate | null;
  createdAt: ISODate;
  orderNumber: string;
  customerName: string;
  assignedName: string | null;
  isOverdue: boolean;
}

export interface TaskInput {
  orderId: string;
  title: string;
  stage: TaskStage;
  assignedTo?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  orderId?: string;
  assignedTo?: string;
  mine?: boolean;
  open?: boolean;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

/* Inventory */
export type MaterialCategory =
  "fabric" | "thread" | "button" | "zipper" | "lining" | "interfacing" | "embellishment" | "other";
export type StockKind = "purchase" | "usage" | "adjustment";

export interface Material {
  id: string;
  branchId: string | null;
  name: string;
  category: MaterialCategory;
  unit: string;
  quantity: number;
  unitCost: number | null;
  minQuantity: number | null;
  supplier: string | null;
  notes: string | null;
  isLowStock: boolean;
  createdAt: ISODate;
}

export interface MaterialInput {
  branchId?: string | null;
  name: string;
  category: MaterialCategory;
  unit: string;
  unitCost?: number | null;
  minQuantity?: number | null;
  supplier?: string | null;
  notes?: string | null;
  openingQuantity?: number;
}

export interface StockMovement {
  id: string;
  kind: StockKind;
  change: number;
  balanceAfter: number;
  unitCost: number | null;
  orderId: string | null;
  orderNumber: string | null;
  note: string | null;
  createdAt: ISODate;
}

export interface MovementInput {
  kind: StockKind;
  quantity: number;
  unitCost?: number;
  orderId?: string | null;
  note?: string | null;
}

/* Expenses */
export type ExpenseCategory = "materials" | "rent" | "electricity" | "transport" | "wages" | "equipment" | "other";

export interface Expense {
  id: string;
  branchId: string | null;
  category: ExpenseCategory;
  amount: number;
  spentOn: string;
  description: string;
  method: PaymentMethod;
  reference: string | null;
  createdAt: ISODate;
}

export interface ExpenseInput {
  branchId?: string | null;
  category: ExpenseCategory;
  amount: number;
  spentOn?: string;
  description: string;
  method: PaymentMethod;
  reference?: string | null;
}

export interface ExpenseFilters {
  category?: ExpenseCategory;
  branchId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/* Reports */
export interface Period {
  from?: string;
  to?: string;
  branchId?: string;
}

export interface IncomeExpensesReport {
  period: { from: string; to: string; timeZone: string };
  currency: string;
  orderValue: number;
  received: number;
  refunded: number;
  netReceived: number;
  expenses: { total: number; byCategory: { category: ExpenseCategory; total: number; count: number }[] };
  estimatedProfit: number;
  byMonth: { month: string; netReceived: number; expenses: number; net: number }[];
}

export interface GarmentSalesReport {
  period: { from: string; to: string; timeZone: string };
  currency: string;
  garments: { garmentName: string; quantity: number; orders: number; value: number }[];
}

export type ExportKey = "income-expenses" | "garment-sales" | "orders" | "payments" | "expenses";

/* Platform admin */
export interface PlatformOverview {
  businesses: { total: number; active: number; suspended: number; scheduledForDeletion: number; newLast30Days: number };
  users: { total: number; active: number; disabled: number; signedIn: number };
  activity: { ordersLast30Days: number; appointmentsLast30Days: number; activeBusinessesLast30Days: number };
}

/** What a platform admin can change on any business, including what its owner can't (email, currency, time zone). */
export type AdminBusinessInput = Partial<
  Pick<AdminBusiness, "name" | "email" | "phone" | "address" | "currency" | "timeZone" | "measurementUnit">
> & { reason?: string };

export interface AdminBusiness {
  id: string;
  name: string;
  status: "active" | "suspended";
  currency: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  timeZone: string;
  measurementUnit: "in" | "cm";
  createdAt: ISODate;
  deletionScheduledFor: ISODate | null;
  owner: { id: string; fullName: string; email: string } | null;
  counts: { members: number; customers: number; orders: number };
  lastOrderAt: ISODate | null;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "disabled";
  platformRole: "user" | "super_admin";
  hasSignedIn: boolean;
  businessName: string;
  role: MemberRole | null;
  createdAt: ISODate;
}
