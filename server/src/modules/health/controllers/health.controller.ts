import type { Request, Response } from "express";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { HealthService } from "../services/health.service";

export class HealthController {
  static async check(_req: Request, res: Response): Promise<void> {
    const health = await HealthService.Instance.check();
    if (!health.database.ok) {
      res.status(503).json({ ...ApiResponse.error("Service degraded", 503), data: health });
      return;
    }
    res.json(ApiResponse.ok("Service healthy", health));
  }
}
