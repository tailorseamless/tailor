import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { RequestService } from "../services/request.service";
import {
  acceptRequestSchema,
  declineRequestSchema,
  listRequestsSchema,
  requestIdSchema,
} from "../validators/request.schema";

export class RequestController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listRequestsSchema);
    const result = await RequestService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Requests fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, requestIdSchema);
    res.json(ApiResponse.ok("Request fetched", await RequestService.Instance.detail(authUser(req), params.id)));
  }

  static async accept(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, acceptRequestSchema);
    const result = await RequestService.Instance.accept(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Request accepted", result));
  }

  static async decline(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, declineRequestSchema);
    res.json(ApiResponse.ok("Request declined", await RequestService.Instance.decline(authUser(req), params.id, body)));
  }
}
