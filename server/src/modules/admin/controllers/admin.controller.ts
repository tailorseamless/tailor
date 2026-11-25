import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { AdminService } from "../services/admin.service";
import {
  adminBusinessIdSchema,
  listAuditLogsSchema,
  listBusinessesSchema,
  listUsersSchema,
  setBusinessStatusSchema,
  setUserStatusSchema,
  updateBusinessProfileSchema,
} from "../validators/admin.schema";

export class AdminController {
  static async overview(_req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("Overview fetched", await AdminService.Instance.overview()));
  }

  static async businesses(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listBusinessesSchema);
    const result = await AdminService.Instance.businesses(query);
    res.json(ApiResponse.ok("Businesses fetched", result.data, result.meta));
  }

  static async business(req: Request, res: Response): Promise<void> {
    const { params } = input(req, adminBusinessIdSchema);
    res.json(ApiResponse.ok("Business fetched", await AdminService.Instance.business(params.id)));
  }

  static async setBusinessStatus(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, setBusinessStatusSchema);
    const business = await AdminService.Instance.setBusinessStatus(authUser(req), params.id, body.status, body.reason);
    res.json(ApiResponse.ok(body.status === "suspended" ? "Business suspended" : "Business reactivated", business));
  }

  static async updateBusinessProfile(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateBusinessProfileSchema);
    const business = await AdminService.Instance.updateBusinessProfile(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Business updated", business));
  }

  static async users(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listUsersSchema);
    const result = await AdminService.Instance.users(query);
    res.json(ApiResponse.ok("People fetched", result.data, result.meta));
  }

  static async setUserStatus(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, setUserStatusSchema);
    const user = await AdminService.Instance.setUserStatus(authUser(req), params.id, body.status, body.reason);
    res.json(ApiResponse.ok(body.status === "disabled" ? "Account disabled" : "Account enabled", user));
  }

  static async admins(_req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("Platform admins fetched", await AdminService.Instance.admins()));
  }

  /** Keyset-paged: `meta.nextCursor` is the cursor for the next page (null on the last). */
  static async auditLogs(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listAuditLogsSchema);
    const page = await AdminService.Instance.auditLogs(query);
    res.json(
      ApiResponse.ok("Audit log fetched", page.data, {
        page: 1,
        limit: query.limit,
        total: 0,
        totalPages: 0,
        hasNext: page.nextCursor !== null,
        hasPrev: Boolean(query.cursor),
        nextCursor: page.nextCursor,
      }),
    );
  }
}
