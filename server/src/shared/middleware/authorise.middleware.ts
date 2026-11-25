import type { NextFunction, Request, RequestHandler, Response } from "express";
import { PERMISSIONS, type AppRole, type Permission } from "../../config/permissions";
import { SecurityMonitor } from "../../modules/system/services/securityMonitor.service";
import { AppError } from "../errors/AppError";

export type PermissionGuard = RequestHandler & { permission: Permission };

/**
 * The route guard (Backend Guide §13.2): says what KIND of thing the caller may
 * do. It never queries the database — roles were resolved once by authMiddleware.
 * Which RECORD they may touch is the service's decision.
 */
export function authorise(permission: Permission): PermissionGuard {
  const allowed: readonly AppRole[] = PERMISSIONS[permission];
  const guard = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw AppError.unauthorised();
    if (!req.user.roles.some((role) => allowed.includes(role))) {
      SecurityMonitor.Instance.note("forbidden", req.user.id);
      throw AppError.forbidden();
    }
    next();
  };
  // Read by the authorisation-matrix test to map every route to its permission.
  return Object.assign(guard, { permission });
}
