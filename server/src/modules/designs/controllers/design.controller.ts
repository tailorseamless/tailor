import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { DesignService } from "../services/design.service";
import {
  createDesignSchema,
  designIdSchema,
  designImageSchema,
  listDesignsSchema,
  updateDesignSchema,
} from "../validators/design.schema";

export class DesignController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listDesignsSchema);
    const result = await DesignService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Designs fetched", result.data, result.meta));
  }

  static async categories(req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("Categories fetched", await DesignService.Instance.categories(authUser(req))));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, designIdSchema);
    res.json(ApiResponse.ok("Design fetched", await DesignService.Instance.detail(authUser(req), params.id)));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createDesignSchema);
    const design = await DesignService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Design created", design));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateDesignSchema);
    res.json(ApiResponse.ok("Design updated", await DesignService.Instance.update(authUser(req), params.id, body)));
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const { params } = input(req, designIdSchema);
    await DesignService.Instance.remove(authUser(req), params.id);
    res.json(ApiResponse.ok("Design deleted", null));
  }

  static async addImages(req: Request, res: Response): Promise<void> {
    const { params } = input(req, designIdSchema);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const design = await DesignService.Instance.addImages(authUser(req), params.id, files);
    res.status(201).json(ApiResponse.created("Pictures added", design));
  }

  static async removeImage(req: Request, res: Response): Promise<void> {
    const { params } = input(req, designImageSchema);
    const design = await DesignService.Instance.removeImage(authUser(req), params.id, params.imageId);
    res.json(ApiResponse.ok("Picture removed", design));
  }
}
