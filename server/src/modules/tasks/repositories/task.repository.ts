import type { SelectQueryBuilder } from "typeorm";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { ListTasksParams, TaskDTO, TaskRecord } from "../dto/task.dto";
import { ProductionTask } from "../entities/productionTask.entity";

/** What the joined query returns; the service adds `isOverdue`. */
export type TaskRow = Omit<TaskDTO, "isOverdue">;

type TaskInput = Pick<TaskRecord, "orderId" | "title" | "stage" | "assignedTo" | "dueDate" | "notes">;

function toRecord(row: ProductionTask): TaskRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    orderId: row.orderId,
    title: row.title,
    stage: row.stage,
    status: row.status,
    assignedTo: row.assignedTo ?? null,
    dueDate: row.dueDate ?? null,
    notes: row.notes ?? null,
    completedAt: row.completedAt ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TaskRepository extends BaseRepository<ProductionTask> {
  static Instance = new TaskRepository();

  private constructor() {
    super(ProductionTask);
  }

  /** One query with the order, customer and assignee joined in (no N+1). */
  private withNames(tx?: Tx): SelectQueryBuilder<ProductionTask> {
    return (
      this.repo(tx)
        .createQueryBuilder("t")
        // Joins keep soft-deleted customers, orders and staff: history must still show whose it was (PRD BR-014).
        .withDeleted()
        .innerJoin("orders", "o", "o.id = t.order_id")
        .innerJoin("customers", "c", "c.id = o.customer_id")
        .leftJoin("users", "u", "u.id = t.assigned_to")
        .select("t.id", "id")
        .addSelect("t.businessId", "businessId")
        .addSelect("t.orderId", "orderId")
        .addSelect("t.title", "title")
        .addSelect("t.stage", "stage")
        .addSelect("t.status", "status")
        .addSelect("t.assignedTo", "assignedTo")
        .addSelect("t.dueDate", "dueDate")
        .addSelect("t.notes", "notes")
        .addSelect("t.completedAt", "completedAt")
        .addSelect("t.createdBy", "createdBy")
        .addSelect("t.createdAt", "createdAt")
        .addSelect("t.updatedAt", "updatedAt")
        .addSelect("o.order_number", "orderNumber")
        .addSelect("c.full_name", "customerName")
        .addSelect("u.full_name", "assignedName")
        .where("t.deletedAt IS NULL")
    );
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<TaskRow | null> {
    const row = await this.withNames(tx)
      .andWhere("t.id = :id AND t.businessId = :businessId", { id, businessId })
      .getRawOne<TaskRow>();
    return row ?? null;
  }

  /** Reads the task under a row lock, so two changes at once queue up (Backend Guide §8.4). */
  async findForUpdate(id: string, businessId: string, tx: Tx): Promise<TaskRecord | null> {
    const row = await this.repo(tx)
      .createQueryBuilder("t")
      .setLock("pessimistic_write")
      .where("t.id = :id AND t.businessId = :businessId", { id, businessId })
      .getOne();
    return row ? toRecord(row) : null;
  }

  /**
   * Soonest due first, undated last.
   * Indexes: production_tasks(business_id, status, due_date | assigned_to, status), production_tasks(order_id).
   */
  async listForBusiness(params: ListTasksParams): Promise<Paginated<TaskRow>> {
    const qb = this.withNames().andWhere("t.businessId = :businessId", { businessId: params.businessId });

    if (params.status) qb.andWhere("t.status = :status", { status: params.status });
    if (params.stage) qb.andWhere("t.stage = :stage", { stage: params.stage });
    if (params.orderId) qb.andWhere("t.orderId = :orderId", { orderId: params.orderId });
    if (params.branchId) qb.andWhere("o.branch_id = :branchId", { branchId: params.branchId });
    if (params.assignedTo) qb.andWhere("t.assignedTo = :assignedTo", { assignedTo: params.assignedTo });
    if (params.open || params.overdue) qb.andWhere("t.status IN ('todo','in_progress')");
    if (params.overdue) qb.andWhere("t.dueDate < :today", { today: params.today });
    qb.orderBy("t.dueDate", "ASC", "NULLS LAST").addOrderBy("t.createdAt", "ASC").addOrderBy("t.id", "ASC");

    return this.paginateRaw<TaskRow, ProductionTask>(qb, params.page, params.limit);
  }

  async createTask(data: TaskInput & { businessId: string; createdBy: string }, tx: Tx): Promise<string> {
    return (await this.create({ ...data, status: "todo" }, tx)).id;
  }

  async updateTask(
    id: string,
    businessId: string,
    data: Partial<Omit<TaskInput, "orderId"> & Pick<TaskRecord, "status" | "completedAt">>,
    tx: Tx,
  ): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }

  /** Clears the assignee on open tasks of someone who is leaving the team. */
  async unassignOpen(businessId: string, userId: string, tx: Tx): Promise<number> {
    const result = await this.repo(tx)
      .createQueryBuilder()
      .update()
      .set({ assignedTo: null, updatedAt: new Date() })
      .where("business_id = :businessId AND assigned_to = :userId AND status IN ('todo','in_progress')", {
        businessId,
        userId,
      })
      .execute();
    return result.affected ?? 0;
  }
}
