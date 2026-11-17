import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { dashboardSchema as periodSchema } from "../../dashboard/validators/dashboard.schema";
import { ReportService } from "../services/report.service";
import { ReportExportService } from "../services/reportExport.service";
import { exportSchema } from "../validators/export.schema";

export class ReportController {
  static async incomeAndExpenses(req: Request, res: Response): Promise<void> {
    const { query } = input(req, periodSchema);
    res.json(ApiResponse.ok("Report fetched", await ReportService.Instance.incomeAndExpenses(authUser(req), query)));
  }

  /** A file, not the JSON envelope. Built in full before any byte is sent, so errors stay ordinary JSON. */
  static async export(req: Request, res: Response): Promise<void> {
    const { params, query } = input(req, exportSchema);
    const file = await ReportExportService.Instance.export(authUser(req), params.key, query);
    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    });
    res.send(file.content);
  }

  static async garmentSales(req: Request, res: Response): Promise<void> {
    const { query } = input(req, periodSchema);
    res.json(ApiResponse.ok("Report fetched", await ReportService.Instance.garmentSales(authUser(req), query)));
  }
}
