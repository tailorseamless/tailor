import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

/**
 * The tenant comes from the authenticated user's own business — never from
 * anything the client sends (Backend Guide §13.4).
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw AppError.unauthorised();
  req.tenant = { businessId: req.user.businessId };
  next();
}
