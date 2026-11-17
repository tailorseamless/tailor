import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { OrderService } from "../services/order.service";
import {
  changeOrderStatusSchema,
  createOrderSchema,
  listOrdersSchema,
  orderIdSchema,
  orderImageSchema,
  updateOrderSchema,
} from "../validators/order.schema";

export class OrderController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listOrdersSchema);
    const result = await OrderService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Orders fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, orderIdSchema);
    const order = await OrderService.Instance.detail(authUser(req), params.id);
    res.json(ApiResponse.ok("Order fetched", order));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createOrderSchema);
    const order = await OrderService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Order created", order));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateOrderSchema);
    const order = await OrderService.Instance.update(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Order updated", order));
  }

  static async changeStatus(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, changeOrderStatusSchema);
    const order = await OrderService.Instance.changeStatus(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Order status updated", order));
  }

  static async addImages(req: Request, res: Response): Promise<void> {
    const { params } = input(req, orderIdSchema);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const order = await OrderService.Instance.addImages(authUser(req), params.id, files);
    res.status(201).json(ApiResponse.created("Pictures added", order));
  }

  static async removeImage(req: Request, res: Response): Promise<void> {
    const { params } = input(req, orderImageSchema);
    const order = await OrderService.Instance.removeImage(authUser(req), params.id, params.imageId);
    res.json(ApiResponse.ok("Picture removed", order));
  }
}
