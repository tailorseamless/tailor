import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { BranchService } from "../services/branch.service";
import {
  branchIdSchema,
  createBranchSchema,
  listBranchesSchema,
  updateBranchSchema,
} from "../validators/branch.schema";

export class BranchController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listBranchesSchema);
    const result = await BranchService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Branches fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, branchIdSchema);
    res.json(ApiResponse.ok("Branch fetched", await BranchService.Instance.detail(authUser(req), params.id)));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createBranchSchema);
    const branch = await BranchService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Branch created", branch));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateBranchSchema);
    res.json(ApiResponse.ok("Branch updated", await BranchService.Instance.update(authUser(req), params.id, body)));
  }
}
