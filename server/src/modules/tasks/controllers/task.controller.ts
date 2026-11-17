import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { TaskService } from "../services/task.service";
import {
  changeTaskStatusSchema,
  createTaskSchema,
  listTasksSchema,
  taskIdSchema,
  updateTaskSchema,
} from "../validators/task.schema";

export class TaskController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listTasksSchema);
    const result = await TaskService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Tasks fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, taskIdSchema);
    res.json(ApiResponse.ok("Task fetched", await TaskService.Instance.detail(authUser(req), params.id)));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createTaskSchema);
    const task = await TaskService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Task created", task));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateTaskSchema);
    res.json(ApiResponse.ok("Task updated", await TaskService.Instance.update(authUser(req), params.id, body)));
  }

  static async changeStatus(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, changeTaskStatusSchema);
    const task = await TaskService.Instance.changeStatus(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Task status updated", task));
  }
}
