import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { MeasurementService } from "../services/measurement.service";
import { createMeasurementSchema, listMeasurementsSchema, measurementIdSchema } from "../validators/measurement.schema";

export class MeasurementController {
  static async list(req: Request, res: Response): Promise<void> {
    const { params, query } = input(req, listMeasurementsSchema);
    const result = await MeasurementService.Instance.list(authUser(req), params.customerId, query);
    res.json(ApiResponse.ok("Measurements fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, measurementIdSchema);
    const measurement = await MeasurementService.Instance.detail(authUser(req), params.customerId, params.id);
    res.json(ApiResponse.ok("Measurement fetched", measurement));
  }

  static async record(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, createMeasurementSchema);
    const measurement = await MeasurementService.Instance.record(authUser(req), params.customerId, body);
    res.status(201).json(ApiResponse.created("Measurement recorded", measurement));
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const { params } = input(req, measurementIdSchema);
    await MeasurementService.Instance.remove(authUser(req), params.customerId, params.id);
    res.json(ApiResponse.ok("Measurement deleted", null));
  }
}
