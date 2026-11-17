import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { TeamService } from "../services/team.service";
import { addMemberSchema, listTeamSchema, memberIdSchema, updateMemberSchema } from "../validators/team.schema";

export class TeamController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listTeamSchema);
    const result = await TeamService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Team fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, memberIdSchema);
    res.json(ApiResponse.ok("Team member fetched", await TeamService.Instance.detail(authUser(req), params.userId)));
  }

  static async add(req: Request, res: Response): Promise<void> {
    const { body } = input(req, addMemberSchema);
    const member = await TeamService.Instance.add(authUser(req), body);
    res.status(201).json(ApiResponse.created("Team member added", member));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateMemberSchema);
    const member = await TeamService.Instance.update(authUser(req), params.userId, body);
    res.json(ApiResponse.ok("Team member updated", member));
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const { params } = input(req, memberIdSchema);
    const result = await TeamService.Instance.remove(authUser(req), params.userId);
    res.json(ApiResponse.ok("Team member removed", result));
  }

  static async resendInvitation(req: Request, res: Response): Promise<void> {
    const { params } = input(req, memberIdSchema);
    const result = await TeamService.Instance.resendInvitation(authUser(req), params.userId);
    res
      .status(202)
      .json(
        ApiResponse.ok(
          result.emailEnabled ? "Invitation queued for sending" : "Invitation queued; email is not set up yet",
          result,
        ),
      );
  }
}
