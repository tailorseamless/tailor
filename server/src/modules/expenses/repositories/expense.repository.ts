import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { ExpenseCategoryTotal, ExpenseRecord, ListExpensesParams } from "../dto/expense.dto";
import { Expense } from "../entities/expense.entity";

type ExpenseInput = Pick<
  ExpenseRecord,
  "branchId" | "category" | "amount" | "spentOn" | "description" | "method" | "reference"
>;

function toRecord(row: Expense): ExpenseRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    branchId: row.branchId ?? null,
    category: row.category,
    amount: Number(row.amount),
    spentOn: row.spentOn,
    description: row.description,
    method: row.method,
    reference: row.reference ?? null,
    recordedBy: row.recordedBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ExpenseRepository extends BaseRepository<Expense> {
  static Instance = new ExpenseRepository();

  private constructor() {
    super(Expense);
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<ExpenseRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  /** Newest first. Indexes: expenses(business_id, spent_on | category). */
  async listForBusiness(params: ListExpensesParams): Promise<Paginated<ExpenseRecord>> {
    const qb = this.repo()
      .createQueryBuilder("e")
      .where("e.businessId = :businessId", { businessId: params.businessId });
    if (params.category) qb.andWhere("e.category = :category", { category: params.category });
    if (params.branchId) qb.andWhere("e.branchId = :branchId", { branchId: params.branchId });
    if (params.from) qb.andWhere("e.spentOn >= :from", { from: params.from });
    if (params.to) qb.andWhere("e.spentOn <= :to", { to: params.to });
    if (params.search) qb.andWhere("e.description ILIKE :term", { term: likePattern(params.search) });
    qb.orderBy("e.spentOn", "DESC").addOrderBy("e.createdAt", "DESC").addOrderBy("e.id", "DESC");

    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  /** Spending per category between two days, inclusive. Index: expenses(business_id, spent_on). */
  async totalsByCategory(
    businessId: string,
    from: string,
    to: string,
    branchId: string | null = null,
  ): Promise<ExpenseCategoryTotal[]> {
    const rows: { category: ExpenseCategoryTotal["category"]; total: string; count: number }[] =
      await this.repo().query(
        `SELECT category, SUM(amount) AS total, COUNT(*)::int AS count
         FROM expenses
        WHERE business_id = $1 AND deleted_at IS NULL AND spent_on >= $2::date AND spent_on <= $3::date
          AND ($4::uuid IS NULL OR branch_id = $4)
        GROUP BY category
        ORDER BY SUM(amount) DESC`,
        [businessId, from, to, branchId],
      );
    return rows.map((row) => ({ ...row, total: Number(row.total) }));
  }

  async createExpense(data: ExpenseInput & { businessId: string; recordedBy: string }, tx: Tx): Promise<ExpenseRecord> {
    return toRecord(await this.create(data, tx));
  }

  async updateExpense(id: string, businessId: string, data: Partial<ExpenseInput>, tx: Tx): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }

  async removeInBusiness(id: string, businessId: string, tx: Tx): Promise<void> {
    await this.repo(tx).softDelete({ id, businessId });
  }
}
