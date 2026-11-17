import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { InventoryService } from "../services/inventory.service";
import {
  createMaterialSchema,
  listMaterialsSchema,
  listMovementsSchema,
  materialIdSchema,
  recordMovementSchema,
  updateMaterialSchema,
} from "../validators/inventory.schema";

export class InventoryController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listMaterialsSchema);
    const result = await InventoryService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Materials fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, materialIdSchema);
    res.json(ApiResponse.ok("Material fetched", await InventoryService.Instance.detail(authUser(req), params.id)));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createMaterialSchema);
    const material = await InventoryService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Material created", material));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateMaterialSchema);
    res.json(
      ApiResponse.ok("Material updated", await InventoryService.Instance.update(authUser(req), params.id, body)),
    );
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const { params } = input(req, materialIdSchema);
    await InventoryService.Instance.remove(authUser(req), params.id);
    res.json(ApiResponse.ok("Material deleted", null));
  }

  static async recordMovement(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, recordMovementSchema);
    const result = await InventoryService.Instance.recordMovement(authUser(req), params.id, body);
    res.status(201).json(ApiResponse.created("Stock updated", result));
  }

  static async movements(req: Request, res: Response): Promise<void> {
    const { params, query } = input(req, listMovementsSchema);
    const result = await InventoryService.Instance.movements(authUser(req), params.id, query);
    res.json(ApiResponse.ok("Stock movements fetched", result.data, result.meta));
  }
}
