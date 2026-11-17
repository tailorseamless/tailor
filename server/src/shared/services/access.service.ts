import type { AppRole, MemberRole } from "../../config/permissions";

/**
 * Who is acting (Backend Guide §7, §23). Services take an Actor as their first
 * argument and never read a user from a request or a global.
 */
export type PlatformRole = "user" | "super_admin";

export interface Actor {
  id: string;
  /** The tenant. Goes into every repository call before anything else (§13.4). */
  businessId: string;
  platformRole: PlatformRole;
  roles: AppRole[];
  timeZone: string;
}

/** `req.user` — structurally an Actor, plus the login it came from. */
export interface AuthUser extends Actor {
  firebaseUid: string;
  email: string;
}

/** `req.firebase` — the verified Firebase login, before (or without) a linked user. */
export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  signInProvider: string | null;
}

/**
 * Roles are derived, not stored (Backend Guide §23.1): an ACTIVE membership
 * gives its role; a platform super-admin is also `admin`.
 */
export function rolesFromFlags(flags: {
  platformRole: PlatformRole;
  memberRole: MemberRole | null;
  memberStatus: string | null;
}): AppRole[] {
  const roles: AppRole[] = [];
  if (flags.memberRole && flags.memberStatus === "active") roles.push(flags.memberRole);
  if (flags.platformRole === "super_admin") roles.push("admin");
  return roles;
}

/**
 * A password login is trusted only once its email is verified; Google verifies
 * its own (Firebase Guide §4.6, §4.10).
 */
export function hasTrustedEmail(identity: FirebaseIdentity): identity is FirebaseIdentity & { email: string } {
  return Boolean(identity.email) && (identity.emailVerified || identity.signInProvider === "google.com");
}
