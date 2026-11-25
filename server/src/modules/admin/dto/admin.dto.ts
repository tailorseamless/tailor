import type { MemberRole } from "../../../config/permissions";
import type { PlatformRole } from "../../../shared/services/access.service";
import type { BusinessStatus } from "../../businesses/dto/business.dto";
import type { OnboardingState, UserStatus } from "../../users/dto/user.dto";
import type { OpenAlertCounts } from "./alert.dto";

/**
 * The platform admin's view (`platformRole` support or super_admin). It spans every
 * business, so it shows COUNTS and account details only — never customers,
 * measurements, orders or payments of a business.
 */
export interface PlatformOverviewDTO {
  businesses: { total: number; active: number; suspended: number; scheduledForDeletion: number; newLast30Days: number };
  users: { total: number; active: number; disabled: number; signedIn: number };
  activity: { ordersLast30Days: number; appointmentsLast30Days: number; activeBusinessesLast30Days: number };
  /** Open alerts by severity: what needs attention now. */
  alerts: OpenAlertCounts;
}

export interface AdminBusinessDTO {
  id: string;
  name: string;
  status: BusinessStatus;
  currency: string;
  /** The business's own contact details and settings (account-level: never its customers or orders). */
  email: string | null;
  phone: string | null;
  address: string | null;
  timeZone: string;
  measurementUnit: "in" | "cm";
  createdAt: Date;
  deletionScheduledFor: Date | null;
  owner: { id: string; fullName: string; email: string } | null;
  counts: { members: number; customers: number; orders: number };
  lastOrderAt: Date | null;
}

export interface AdminUserDTO {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
  /** As stored. Someone named in PLATFORM_ADMIN_EMAILS may show `user` here: see GET /admin/admins. */
  platformRole: PlatformRole;
  hasSignedIn: boolean;
  /** Their last signed-in request, to the hour. */
  lastSeenAt: Date | null;
  businessId: string;
  businessName: string;
  role: MemberRole | null;
  createdAt: Date;
}

/** A person on a business's team, as the admin sees them. */
export interface AdminMemberDTO {
  userId: string;
  fullName: string;
  email: string;
  role: MemberRole;
  memberStatus: "active" | "suspended";
  userStatus: UserStatus;
  platformRole: PlatformRole;
  hasSignedIn: boolean;
  lastSeenAt: Date | null;
  addedAt: Date;
}

/**
 * Business 360: everything the admin may know about one business on one page. Activity is COUNTS
 * only — never its customers, measurements, orders or payments themselves.
 */
export interface AdminBusinessDetailDTO {
  business: AdminBusinessDTO;
  publicPage: { slug: string | null; pageEnabled: boolean; bookingEnabled: boolean };
  members: AdminMemberDTO[];
  /** The owner's getting-started guide; null when it was never opened. */
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
  /** Emails this business sent customers and staff in the last 30 days. */
  email30d: { sent: number; failed: number; pending: number };
  /** Audit entries per week, oldest first, for the last 12 weeks (weeks start on Monday). */
  activityByWeek: { weekStart: string; events: number }[];
  lastActivityAt: Date | null;
  openAlerts: number;
}

/** User 360: one person's account. What they did and what was done to them come from the audit log. */
export interface AdminUserDetailDTO {
  user: AdminUserDTO & {
    timeZone: string;
    deletionScheduledFor: Date | null;
    onboarding: OnboardingState | null;
    memberStatus: "active" | "suspended" | null;
    /** Named in PLATFORM_ADMIN_EMAILS (a super admin whatever `platformRole` says). */
    adminBySetting: boolean;
  };
  /** How many audit entries they are the actor of, in total and in the last 30 days. */
  actions: { total: number; last30Days: number };
}

/**
 * Someone with platform power, and where it comes from: the database (`admin:grant`) or the
 * PLATFORM_ADMIN_EMAILS setting (which always means super admin, and needs a verified email to work).
 */
export interface PlatformAdminDTO {
  email: string;
  role: "support" | "super_admin";
  sources: ("database" | "setting")[];
  /** Null when the setting names an address nobody has an account with. */
  user: {
    id: string;
    fullName: string;
    status: UserStatus;
    businessName: string;
    hasSignedIn: boolean;
  } | null;
}

export interface ListAdminBusinessesParams {
  page: number;
  limit: number;
  search?: string;
  status?: BusinessStatus;
}

export interface ListAdminUsersParams {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
  businessId?: string;
}
