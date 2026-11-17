import type { Request, Response } from "express";
import { firebaseIdentity, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { AuthService } from "../services/auth.service";
import { registerSchema } from "../validators/user.schema";

export class AuthController {
  static async me(req: Request, res: Response): Promise<void> {
    const me = await AuthService.Instance.me(firebaseIdentity(req));
    res.json(ApiResponse.ok("Account fetched", me));
  }

  static async register(req: Request, res: Response): Promise<void> {
    const { body } = input(req, registerSchema);
    const me = await AuthService.Instance.register(firebaseIdentity(req), body);
    res.status(201).json(ApiResponse.created("Business created", me));
  }
}
