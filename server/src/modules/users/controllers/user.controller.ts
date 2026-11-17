import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { UserService } from "../services/user.service";
import { updateMeSchema } from "../validators/user.schema";

export class UserController {
  static async updateMe(req: Request, res: Response): Promise<void> {
    const { body } = input(req, updateMeSchema);
    const me = await UserService.Instance.updateMe(authUser(req), body);
    res.json(ApiResponse.ok("Profile updated", me));
  }
}
