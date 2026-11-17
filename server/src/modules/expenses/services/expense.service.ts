import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { localDay } from "../../../shared/utils/timezone";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import type { ExpenseRecord } from "../dto/expense.dto";
import { BranchService } from "../../branches/services/branch.service";
import { ExpenseRepository } from "../repositories/expense.repository";
import type { CreateExpenseInput, ListExpensesQuery, UpdateExpenseInput } from "../validators/expense.schema";

/** Business expenses (PRD US-038). Every change is audited with the amounts before and after. */
export class ExpenseService {
  static Instance = new ExpenseService();

  private constructor(
    private readonly expenses = ExpenseRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  list(actor: Actor, query: ListExpensesQuery): Promise<Paginated<ExpenseRecord>> {
    return this.expenses.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
  }

  /** Another business's expense is a 404: existence must not leak. */
  async detail(actor: Actor, id: string): Promise<ExpenseRecord> {
    const expense = await this.expenses.findInBusiness(id, actor.businessId);
    if (!expense) throw AppError.notFound("Expense not found");
    return expense;
  }

  async create(actor: Actor, input: CreateExpenseInput): Promise<ExpenseRecord> {
    return runInTransaction(async (tx) => {
      const expense = await this.expenses.createExpense(
        {
          businessId: actor.businessId,
          branchId: await this.branches.resolve(actor, input.branchId, tx),
          category: input.category,
          amount: input.amount,
          spentOn: input.spentOn ?? localDay(new Date(), actor.timeZone),
          description: input.description,
          method: input.method,
          reference: input.reference ?? null,
          recordedBy: actor.id,
        },
        tx,
      );
      await this.audit(
        actor,
        "expense.created",
        expense.id,
        { amount: expense.amount, category: expense.category },
        tx,
      );
      return expense;
    });
  }

  async update(actor: Actor, id: string, input: UpdateExpenseInput): Promise<ExpenseRecord> {
    return runInTransaction(async (tx) => {
      const existing = await this.expenses.findInBusiness(id, actor.businessId, tx);
      if (!existing) throw AppError.notFound("Expense not found");
      await this.branches.assertActive(actor, input.branchId, tx);

      await this.expenses.updateExpense(id, actor.businessId, input, tx);
      await this.audit(
        actor,
        "expense.updated",
        id,
        {
          fields: Object.keys(input),
          ...(input.amount !== undefined ? { amountBefore: existing.amount, amountAfter: input.amount } : {}),
        },
        tx,
      );
      return (await this.expenses.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await runInTransaction(async (tx) => {
      const existing = await this.expenses.findInBusiness(id, actor.businessId, tx);
      if (!existing) throw AppError.notFound("Expense not found");
      await this.expenses.removeInBusiness(id, actor.businessId, tx);
      await this.audit(actor, "expense.deleted", id, { amount: existing.amount, category: existing.category }, tx);
    });
  }

  private audit(actor: Actor, action: AuditAction, id: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      { businessId: actor.businessId, actorId: actor.id, action, entityType: "expense", entityId: id, payload },
      tx,
    );
  }
}
