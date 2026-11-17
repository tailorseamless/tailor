import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { BusinessService } from "../services/business.service";
import { updateBusinessSchema } from "../validators/business.schema";

export class BusinessController {
  static async mine(req: Request, res: Response): Promise<void> {
    const business = await BusinessService.Instance.mine(authUser(req));
    res.json(ApiResponse.ok("Business fetched", business));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { body } = input(req, updateBusinessSchema);
    const business = await BusinessService.Instance.update(authUser(req), body);
    res.json(ApiResponse.ok("Business updated", business));
  }
}
