import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { CustomerService } from "../services/customer.service";
import {
  createCustomerSchema,
  customerIdSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from "../validators/customer.schema";

export class CustomerController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listCustomersSchema);
    const result = await CustomerService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Customers fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, customerIdSchema);
    const customer = await CustomerService.Instance.detail(authUser(req), params.id);
    res.json(ApiResponse.ok("Customer fetched", customer));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createCustomerSchema);
    const customer = await CustomerService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Customer created", customer));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateCustomerSchema);
    const customer = await CustomerService.Instance.update(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Customer updated", customer));
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const { params } = input(req, customerIdSchema);
    await CustomerService.Instance.remove(authUser(req), params.id);
    res.json(ApiResponse.ok("Customer deleted", null));
  }

  static async createPortalLink(req: Request, res: Response): Promise<void> {
    const { params } = input(req, customerIdSchema);
    const link = await CustomerService.Instance.createPortalLink(authUser(req), params.id);
    res.status(201).json(ApiResponse.created("Portal link created. Copy it now — it is shown only once.", link));
  }

  static async revokePortalLink(req: Request, res: Response): Promise<void> {
    const { params } = input(req, customerIdSchema);
    await CustomerService.Instance.revokePortalLink(authUser(req), params.id);
    res.json(ApiResponse.ok("Portal link removed", null));
  }
}
