import type { MemberRole } from "../../../config/permissions";
import type { PlatformRole } from "../../../shared/services/access.service";
import type { BusinessStatus } from "../../businesses/dto/business.dto";
import type { UserStatus } from "../../users/dto/user.dto";

/**
 * The platform admin's view (`platformRole` support or super_admin). It spans every
 * business, so it shows COUNTS and account details only — never customers,
 * measurements, orders or payments of a business.
 */
export interface PlatformOverviewDTO {
  businesses: { total: number; active: number; suspended: number; scheduledForDeletion: number; newLast30Days: number };
  users: { total: number; active: number; disabled: number; signedIn: number };
  activity: { ordersLast30Days: number; appointmentsLast30Days: number; activeBusinessesLast30Days: number };
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
  businessId: string;
  businessName: string;
  role: MemberRole | null;
  createdAt: Date;
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
