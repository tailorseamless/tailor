import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { env } from "../../config/env";
import { firebaseAuth } from "../../infrastructure/firebase/firebaseAdmin";
import { UserService } from "../../modules/users/services/user.service";
import { AppError } from "../errors/AppError";
import { isConfiguredAdmin, type FirebaseIdentity } from "../services/access.service";
import { SESSION_EXPIRED, TOKEN_EXPIRED, sessionHasEnded, tokenHasAged } from "../utils/session";

/**
 * Firebase proves WHO someone is; PostgreSQL decides what they may do
 * (Backend Guide §13.1, Firebase Guide §4.5). The API issues no tokens.
 */
async function verify(req: Request): Promise<FirebaseIdentity> {
  const header = req.get("authorization");
  if (!header || !header.startsWith("Bearer ")) throw AppError.unauthorised();
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw AppError.unauthorised();

  let decoded: DecodedIdToken;
  try {
    // Revocation is not checked (a network call per request); access is cut by
    // disabling the user, whose status is re-read from a 60 s cache.
    decoded = await firebaseAuth().verifyIdToken(token);
  } catch {
    throw AppError.unauthorised("Token invalid or expired");
  }
  // Firebase sign-ins never lapse on their own, so the limit is ours. Outside the try above: this is not a bad token.
  if (sessionHasEnded(decoded.auth_time, env.session.lifetimeMs)) {
    throw AppError.unauthorised("Your session has ended. Please sign in again.", [
      { field: "session", message: SESSION_EXPIRED },
    ]);
  }
  // A token past ACCESS_TOKEN_LIFETIME is not an error the person should see: the app fetches a new one and retries.
  if (tokenHasAged(decoded.iat, env.session.accessTokenMs)) {
    throw AppError.unauthorised("Token expired. Fetch a new one and try again.", [
      { field: "token", message: TOKEN_EXPIRED },
    ]);
  }
  return {
    uid: decoded.uid,
    email: typeof decoded.email === "string" ? decoded.email.toLowerCase() : null,
    emailVerified: decoded.email_verified === true,
    name: typeof decoded.name === "string" ? decoded.name : null,
    picture: typeof decoded.picture === "string" ? decoded.picture : null,
    signInProvider: decoded.firebase?.sign_in_provider ?? null,
  };
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
