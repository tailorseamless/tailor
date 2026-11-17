import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { DashboardService } from "../services/dashboard.service";
import { dashboardSchema } from "../validators/dashboard.schema";

export class DashboardController {
  static async overview(req: Request, res: Response): Promise<void> {
    const { query } = input(req, dashboardSchema);
    const dashboard = await DashboardService.Instance.overview(authUser(req), query);
    res.json(ApiResponse.ok("Dashboard fetched", dashboard));
  }
}
