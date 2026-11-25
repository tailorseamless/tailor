import type { AppRole, MemberRole, Permission } from "../../../config/permissions";
import type { PlatformRole } from "../../../shared/services/access.service";
import type { BusinessRecord, BusinessStatus, MemberStatus } from "../../businesses/dto/business.dto";

export const USER_STATUSES = ["active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PLATFORM_ROLES = ["user", "support", "super_admin"] as const;

/** The getting-started guide a new owner is walked through, in order. */
export const ONBOARDING_STEPS = ["templates", "customers", "order", "designs"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Where this person is in the getting-started guide. NULL for people it was never opened for (team members,
 * accounts from before the guide); they can still start it from Settings.
 */
export interface OnboardingState {
  completed: OnboardingStep[];
  /** They closed the guide; it stays available in Settings. */
  dismissed: boolean;
}

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
  onboarding: OnboardingState | null;
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
  user: Pick<
    UserRecord,
    "id" | "email" | "fullName" | "phone" | "timeZone" | "platformRole" | "deletionScheduledFor" | "onboarding"
  >;
  business: BusinessRecord;
  roles: AppRole[];
  /** For showing or hiding UI only — the API checks again on every request. */
  permissions: Permission[];
  /** How to reach Tailor Seamless support (SUPPORT_WHATSAPP_NUMBER); null hides the link. */
  support: { whatsapp: string | null };
}
