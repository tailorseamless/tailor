import type { Request } from "express";
import type { z, ZodTypeAny } from "zod";
import { AppError } from "../errors/AppError";
import { logger } from "../../infrastructure/logger/logger";
import type { AuthUser, FirebaseIdentity } from "../services/access.service";

/** Typed accessors — controllers never read raw `req.body`/`query`/`params` (Backend Guide §6). */

/** The output of `validate(schema)` on this route. */
export function input<S extends ZodTypeAny>(req: Request, _schema: S): z.infer<S> {
  if (req.validated === undefined) {
    logger.error({ route: req.originalUrl, requestId: req.requestId }, "route is missing validate(schema)");
    throw new AppError("Internal server error", 500);
  }
  return req.validated as z.infer<S>;
}

/** The linked user — the Actor passed to services. */
export function authUser(req: Request): AuthUser {
  if (!req.user) throw AppError.unauthorised();
  return req.user;
}

/** The verified Firebase login, for `firebaseOnly` routes. */
export function firebaseIdentity(req: Request): FirebaseIdentity {
  if (!req.firebase) throw AppError.unauthorised();
  return req.firebase;
}

export function requestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}
