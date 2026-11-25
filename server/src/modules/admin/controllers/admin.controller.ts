import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse, type PaginationMeta } from "../../../shared/response/apiResponse";
import { AdminService } from "../services/admin.service";
import { InsightsService } from "../services/insights.service";
import {
  activityFeedSchema,
  addNoteSchema,
  adminExportSchema,
  adoptionSchema,
  cohortsSchema,
  dailyStatsSchema,
  adminBusinessIdSchema,
  adminUserIdSchema,
  alertIdSchema,
  listAlertsSchema,
  listAuditLogsSchema,
  resolveAlertSchema,
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

  static async businessDetail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, adminBusinessIdSchema);
    res.json(ApiResponse.ok("Business fetched", await AdminService.Instance.businessDetail(authUser(req), params.id)));
  }

  static async userDetail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, adminUserIdSchema);
    res.json(ApiResponse.ok("Person fetched", await AdminService.Instance.userDetail(authUser(req), params.id)));
  }

  /** Keyset-paged like the audit log: `meta.nextCursor` opens the next (older) page. */
  static async activity(req: Request, res: Response): Promise<void> {
    const { query } = input(req, activityFeedSchema);
    const page = await AdminService.Instance.feed(query);
    res.json(ApiResponse.ok("Activity fetched", page.data, cursorMeta(query.limit, query.cursor, page.nextCursor)));
  }

  static async systemHealth(req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("System health fetched", await AdminService.Instance.systemHealth(authUser(req))));
  }

  static async alerts(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listAlertsSchema);
    const result = await AdminService.Instance.alertsList(query);
    res.json(ApiResponse.ok("Alerts fetched", result.data, result.meta));
  }

  static async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    const { params } = input(req, alertIdSchema);
    res.json(
      ApiResponse.ok("Alert acknowledged", await AdminService.Instance.acknowledgeAlert(authUser(req), params.id)),
    );
  }

  static async resolveAlert(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, resolveAlertSchema);
    const alert = await AdminService.Instance.resolveAlert(authUser(req), params.id, body.note ?? null);
    res.json(ApiResponse.ok("Alert resolved", alert));
  }

  static async dailyStats(req: Request, res: Response): Promise<void> {
    const { query } = input(req, dailyStatsSchema);
    res.json(ApiResponse.ok("Daily figures fetched", await InsightsService.Instance.dailyStats(query.days)));
  }

  static async adoption(req: Request, res: Response): Promise<void> {
    const { query } = input(req, adoptionSchema);
    res.json(ApiResponse.ok("Adoption fetched", await InsightsService.Instance.adoption(query.days)));
  }

  static async cohorts(req: Request, res: Response): Promise<void> {
    const { query } = input(req, cohortsSchema);
    res.json(ApiResponse.ok("Cohorts fetched", await InsightsService.Instance.cohorts(query.weeks)));
  }

  /** A file, not the JSON envelope. Built in full before any byte is sent, so errors stay ordinary JSON. */
  static async export(req: Request, res: Response): Promise<void> {
    const { params, query } = input(req, adminExportSchema);
    const file = await InsightsService.Instance.export(authUser(req), params.kind, query.format, query.days);
    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    });
    res.send(file.content);
  }

  static async notes(req: Request, res: Response): Promise<void> {
    const { params } = input(req, adminBusinessIdSchema);
    res.json(ApiResponse.ok("Notes fetched", await InsightsService.Instance.listNotes(params.id)));
  }

  static async addNote(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, addNoteSchema);
    res.json(ApiResponse.ok("Note added", await InsightsService.Instance.addNote(authUser(req), params.id, body.body)));
  }

  static async admins(_req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("Platform admins fetched", await AdminService.Instance.admins()));
  }

  /** Keyset-paged: `meta.nextCursor` is the cursor for the next page (null on the last). */
  static async auditLogs(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listAuditLogsSchema);
    const page = await AdminService.Instance.auditLogs(query);
    res.json(ApiResponse.ok("Audit log fetched", page.data, cursorMeta(query.limit, query.cursor, page.nextCursor)));
  }
}

/** The envelope's meta for a keyset-paged list: no page numbers or totals, just the next cursor. */
function cursorMeta(limit: number, cursor: string | undefined, nextCursor: string | null): PaginationMeta {
  return {
    page: 1,
    limit,
    total: 0,
    totalPages: 0,
    hasNext: nextCursor !== null,
    hasPrev: Boolean(cursor),
    nextCursor,
  };
}
