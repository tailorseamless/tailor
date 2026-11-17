import type { AppRole, MemberRole, Permission } from "../../../config/permissions";
import type { PlatformRole } from "../../../shared/services/access.service";
import type { BusinessRecord, BusinessStatus, MemberStatus } from "../../businesses/dto/business.dto";

export const USER_STATUSES = ["active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PLATFORM_ROLES = ["user", "super_admin"] as const;

export interface UserRecord {
  id: string;
  businessId: string;
  firebaseUid: string | null;
  /** Stored lower-cased. */
  email: string;
  fullName: string;
  phone: string | null;
  platformRole: PlatformRole;
  status: UserStatus;
  timeZone: string;
  deletionScheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Everything authMiddleware needs about a login, in one query. */
export interface AuthRow {
  id: string;
  firebaseUid: string;
  email: string;
  businessId: string;
  platformRole: PlatformRole;
  status: UserStatus;
  timeZone: string;
  memberRole: MemberRole | null;
  memberStatus: MemberStatus | null;
  businessStatus: BusinessStatus;
}

/** What the client gets back from /auth/me. */
export interface MeDTO {
  user: Pick<UserRecord, "id" | "email" | "fullName" | "phone" | "timeZone" | "platformRole" | "deletionScheduledFor">;
  business: BusinessRecord;
  roles: AppRole[];
  /** For showing or hiding UI only — the API checks again on every request. */
  permissions: Permission[];
}
