import type { ISODate } from "./api.types";
import type { MemberRole, OnboardingState, PlatformRole } from "./auth.types";
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
  /** The usual price range customers see. Either end may be empty ("from …", "up to …"). */
  priceMin: number | null;
  priceMax: number | null;
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
  priceMin: number | null;
  priceMax: number | null;
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
  /** Open (unresolved) alerts by severity. */
  alerts: Record<AlertSeverity, number>;
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
  /** As stored; someone named in the server's PLATFORM_ADMIN_EMAILS may show `user` (see the Admins tab). */
  platformRole: PlatformRole;
  hasSignedIn: boolean;
  /** Their last signed-in request, to the hour. */
  lastSeenAt: ISODate | null;
  businessId: string;
  businessName: string;
  role: MemberRole | null;
  createdAt: ISODate;
}

/** Someone with platform power, and where it comes from (server: `PlatformAdminDTO`). */
export interface PlatformAdmin {
  email: string;
  role: "support" | "super_admin";
  /** `database` = granted with admin:grant; `setting` = named in PLATFORM_ADMIN_EMAILS (always super admin). */
  sources: ("database" | "setting")[];
  user: {
    id: string;
    fullName: string;
    status: "active" | "disabled";
    businessName: string;
    hasSignedIn: boolean;
  } | null;
}

export type AuditActorKind = "user" | "admin" | "system" | "portal" | "public";

/** One entry of the platform audit trail (server: `AuditEntryDTO`). */
export interface AuditEntry {
  id: string;
  createdAt: ISODate;
  action: string;
  outcome: "success" | "denied" | "failed";
  actorKind: AuditActorKind;
  actor: { id: string; fullName: string; email: string } | null;
  business: { id: string; name: string } | null;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditFilters {
  cursor?: string;
  businessId?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  actorKind?: AuditActorKind;
  /** An exact action ("payment.voided") or a domain ("payment."). */
  action?: string;
  from?: string;
  to?: string;
}

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "acknowledged" | "resolved";

/** Something that needs a platform admin's attention (server: `AdminAlertDTO`). */
export interface AdminAlert {
  id: string;
  createdAt: ISODate;
  type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  detail: string | null;
  business: { id: string; name: string } | null;
  data: Record<string, unknown>;
  occurrences: number;
  lastSeenAt: ISODate;
  acknowledged: { by: string | null; at: ISODate } | null;
  /** `by` null = it cleared by itself. */
  resolved: { by: string | null; at: ISODate; note: string | null } | null;
}

export interface AlertFilters {
  page?: number;
  status?: AlertStatus | "active";
  severity?: AlertSeverity;
}

/** One item of the platform activity feed (server: `ActivityItemDTO`). */
export interface ActivityItem {
  id: string;
  createdAt: ISODate;
  action: string;
  actorKind: AuditActorKind;
  actorName: string | null;
  business: { id: string; name: string } | null;
  entityType: string;
  entityId: string | null;
}

export interface AdminMember {
  userId: string;
  fullName: string;
  email: string;
  role: MemberRole;
  memberStatus: "active" | "suspended";
  userStatus: "active" | "disabled";
  platformRole: PlatformRole;
  hasSignedIn: boolean;
  lastSeenAt: ISODate | null;
  addedAt: ISODate;
}

/** Business 360 (server: `AdminBusinessDetailDTO`). Counts only, never the business's records. */
export interface AdminBusinessDetail {
  business: AdminBusiness;
  publicPage: { slug: string | null; pageEnabled: boolean; bookingEnabled: boolean };
  members: AdminMember[];
  onboarding: OnboardingState | null;
  counts: {
    branches: number;
    customers: number;
    ordersOpen: number;
    ordersOverdue: number;
    ordersDelivered: number;
    ordersCancelled: number;
    payments: number;
    appointmentsUpcoming: number;
    requestsPending: number;
    tasksOpen: number;
    designs: number;
    materials: number;
    expenses: number;
  };
  email30d: { sent: number; failed: number; pending: number };
  activityByWeek: { weekStart: string; events: number }[];
  lastActivityAt: ISODate | null;
  openAlerts: number;
  /** How likely it is to stop using the platform, and why; null when suspended. */
  churnRisk: { score: number; level: ChurnLevel; reasons: string[] } | null;
}

/** User 360 (server: `AdminUserDetailDTO`). */
export interface AdminUserDetail {
  user: AdminUser & {
    timeZone: string;
    deletionScheduledFor: ISODate | null;
    onboarding: OnboardingState | null;
    memberStatus: "active" | "suspended" | null;
    adminBySetting: boolean;
  };
  actions: { total: number; last30Days: number };
}

export interface JobHealth {
  name: string;
  lastStartedAt: ISODate | null;
  lastFinishedAt: ISODate | null;
  lastOutcome: "succeeded" | "failed" | null;
  lastSucceededAt: ISODate | null;
  lastFailedAt: ISODate | null;
  consecutiveFailures: number;
  lastDurationMs: number | null;
  lastResult: unknown;
  /** Only for admins with `admin.technical`. */
  lastError: string | null;
}

export interface DeliveryHealth {
  enabled: boolean;
  last24h: { sent: number; failed: number; cancelled: number };
  pending: number;
  oldestPendingAt: ISODate | null;
}

/** GET /admin/system-health (server: `SystemHealthDTO`). */
export interface SystemHealth {
  checkedAt: ISODate;
  api: { uptimeSeconds: number; nodeVersion: string; environment: string };
  database: { ok: boolean; pendingMigrations: boolean | null };
  jobs: { inProcess: boolean; list: JobHealth[] };
  email: DeliveryHealth & {
    recentFailures: { id: string; kind: string; attempts: number; lastError: string | null; updatedAt: ISODate }[];
  };
  push: DeliveryHealth;
  errorMonitoring: { enabled: boolean };
  storage: {
    plan: string | null;
    credits: { used: number; limit: number | null; usedPercent: number | null };
    storageBytes: number;
    bandwidthBytes: number;
    objects: number;
    transformations: number;
    lastUpdated: string | null;
    checkedAt: ISODate;
  } | null;
  tables: { name: string; rows: number; bytes: number }[];
  security: {
    last24h: Record<string, number>;
    /** Only for admins with `admin.technical`. */
    topSources: { kind: string; ip: string; count: number; lastAt: ISODate }[];
  };
}

/** One UTC day of platform figures (server: `DailyStatDTO`). */
export interface DailyStat {
  day: string;
  businessesTotal: number;
  businessesNew: number;
  businessesActive7d: number;
  peopleNew: number;
  peopleActive7d: number;
  ordersNew: number;
  appointmentsNew: number;
  paymentsNew: number;
  emailsSent: number;
  emailsFailed: number;
}

export interface Adoption {
  days: number;
  activeBusinesses: number;
  features: { key: string; label: string; businesses: number }[];
}

export interface Cohort {
  weekStart: string;
  size: number;
  activated: number;
  retention: { week: number; eligible: number; retained: number }[];
}

export interface AdminNote {
  id: string;
  createdAt: ISODate;
  body: string;
  author: { id: string; fullName: string } | null;
}

export type AdminReportKind =
  "churn-risk" | "businesses" | "people" | "admin-actions" | "alerts" | "daily-stats" | "adoption" | "cohorts";

export type ChurnLevel = "high" | "medium" | "low";

/** A business and how likely it is to stop using the platform (server: `ChurnRiskDTO`). */
export interface ChurnRiskItem {
  businessId: string;
  name: string;
  ownerEmail: string | null;
  createdAt: ISODate;
  daysSinceActivity: number | null;
  score: number;
  level: ChurnLevel;
  reasons: string[];
}

export type AnnouncementAudience = "owners" | "everyone";

/** A message from Tailor Seamless to the businesses (server: `AnnouncementDTO`). */
export interface Announcement {
  id: string;
  createdAt: ISODate;
  title: string;
  body: string;
  linkPath: string | null;
  audience: AnnouncementAudience;
  status: "queued" | "sending" | "sent" | "cancelled";
  businessesReached: number;
  recipients: number;
  sentAt: ISODate | null;
  author: { id: string; fullName: string } | null;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  linkPath?: string | null;
  audience: AnnouncementAudience;
}
