import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../../infrastructure/firebase/firebaseAdmin";
import { UserService } from "../../modules/users/services/user.service";
import { AppError } from "../errors/AppError";
import { isConfiguredAdmin, type FirebaseIdentity } from "../services/access.service";

/**
 * Firebase proves WHO someone is; PostgreSQL decides what they may do
 * (Backend Guide §13.1, Firebase Guide §4.5). The API issues no tokens.
 */
async function verify(req: Request): Promise<FirebaseIdentity> {
  const header = req.get("authorization");
  if (!header || !header.startsWith("Bearer ")) throw AppError.unauthorised();
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw AppError.unauthorised();

  try {
    // Revocation is not checked (a network call per request); access is cut by
    // disabling the user, whose status is re-read from a 60 s cache.
    const decoded = await firebaseAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email.toLowerCase() : null,
      emailVerified: decoded.email_verified === true,
      name: typeof decoded.name === "string" ? decoded.name : null,
      picture: typeof decoded.picture === "string" ? decoded.picture : null,
      signInProvider: decoded.firebase?.sign_in_provider ?? null,
    };
  } catch {
    throw AppError.unauthorised("Token invalid or expired");
  }
}

/** A valid token AND a linked, active user. Mounted ONCE, in app.ts (§14.1). */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const identity = await verify(req);
  const user = await UserService.Instance.resolveAuthUser(identity.uid);
  if (!user) throw AppError.unauthorised("Account not linked or disabled");
  req.firebase = identity;
  // A person named in PLATFORM_ADMIN_EMAILS is a platform admin for this request. Nothing is written
  // to the database (and the cached `user` is left alone), so removing them from the setting ends it.
  req.user =
    user.platformRole !== "super_admin" && isConfiguredAdmin(identity)
      ? { ...user, platformRole: "super_admin", roles: [...user.roles, "admin"] }
      : user;
  next();
}

/** A valid token, no linked user required: /auth/me, /auth/register. */
export async function firebaseOnly(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.firebase = await verify(req);
  next();
}
