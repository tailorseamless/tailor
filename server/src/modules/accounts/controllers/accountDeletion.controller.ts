import type { Request, Response } from "express";
import { ACCOUNT_DELETION } from "../../../config/constants";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { AccountDeletionService } from "../services/accountDeletion.service";
import { deleteBusinessSchema } from "../validators/accountDeletion.schema";

const days = ACCOUNT_DELETION.graceDays;

export class AccountDeletionController {
  static async requestMine(req: Request, res: Response): Promise<void> {
    const result = await AccountDeletionService.Instance.requestMine(authUser(req));
    res.json(ApiResponse.ok(`Your account will be deleted in ${days} days. You can cancel until then.`, result));
  }

  static async cancelMine(req: Request, res: Response): Promise<void> {
    await AccountDeletionService.Instance.cancelMine(authUser(req));
    res.json(ApiResponse.ok("Account deletion cancelled", null));
  }

  static async requestBusiness(req: Request, res: Response): Promise<void> {
    const { body } = input(req, deleteBusinessSchema);
    const result = await AccountDeletionService.Instance.requestBusiness(authUser(req), body.confirmName);
    res.json(ApiResponse.ok(`The business will be deleted in ${days} days. You can cancel until then.`, result));
  }

  static async cancelBusiness(req: Request, res: Response): Promise<void> {
    await AccountDeletionService.Instance.cancelBusiness(authUser(req));
    res.json(ApiResponse.ok("Business deletion cancelled", null));
  }
}
