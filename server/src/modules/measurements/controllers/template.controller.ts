import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { MeasurementTemplateService } from "../services/template.service";
import {
  createTemplateSchema,
  listTemplatesSchema,
  templateIdSchema,
  updateTemplateSchema,
} from "../validators/measurement.schema";

export class MeasurementTemplateController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listTemplatesSchema);
    const result = await MeasurementTemplateService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Templates fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, templateIdSchema);
    const template = await MeasurementTemplateService.Instance.detail(authUser(req), params.id);
    res.json(ApiResponse.ok("Template fetched", template));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createTemplateSchema);
    const template = await MeasurementTemplateService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Template created", template));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateTemplateSchema);
    const template = await MeasurementTemplateService.Instance.update(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Template updated", template));
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const { params } = input(req, templateIdSchema);
    await MeasurementTemplateService.Instance.remove(authUser(req), params.id);
    res.json(ApiResponse.ok("Template deleted", null));
  }
}
