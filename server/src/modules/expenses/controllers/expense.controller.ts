import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { ExpenseService } from "../services/expense.service";
import {
  createExpenseSchema,
  expenseIdSchema,
  listExpensesSchema,
  updateExpenseSchema,
} from "../validators/expense.schema";

export class ExpenseController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listExpensesSchema);
    const result = await ExpenseService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Expenses fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, expenseIdSchema);
    res.json(ApiResponse.ok("Expense fetched", await ExpenseService.Instance.detail(authUser(req), params.id)));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createExpenseSchema);
    const expense = await ExpenseService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Expense recorded", expense));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateExpenseSchema);
    res.json(ApiResponse.ok("Expense updated", await ExpenseService.Instance.update(authUser(req), params.id, body)));
  }

  static async remove(req: Request, res: Response): Promise<void> {
    const { params } = input(req, expenseIdSchema);
    await ExpenseService.Instance.remove(authUser(req), params.id);
    res.json(ApiResponse.ok("Expense deleted", null));
  }
}
