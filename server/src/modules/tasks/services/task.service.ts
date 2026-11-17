import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { localDay } from "../../../shared/utils/timezone";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import { NotificationService } from "../../notifications/services/notification.service";
import { isClosed } from "../../orders/domain/orderStatus";
import { OrderRepository } from "../../orders/repositories/order.repository";
import { canTransitionTask, isTaskOverdue, taskStatusLabel } from "../domain/taskStatus";
import type { TaskDTO, TaskRecord } from "../dto/task.dto";
import { TaskRepository, type TaskRow } from "../repositories/task.repository";
import type {
  ChangeTaskStatusInput,
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
} from "../validators/task.schema";

/** Production tasks: who does what on an order, and by when (PRD US-028, US-029). */
export class TaskService {
  static Instance = new TaskService();

  private constructor(
    private readonly tasks = TaskRepository.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly members = MemberRepository.Instance,
    private readonly notifications = NotificationService.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  async list(actor: Actor, query: ListTasksQuery): Promise<Paginated<TaskDTO>> {
    const { mine, ...filters } = query;
    const today = localDay(new Date(), actor.timeZone);
    const page = await this.tasks.listForBusiness({
      ...filters,
      ...(mine ? { assignedTo: actor.id } : {}),
      businessId: actor.businessId, // tenant scope, always
      today,
    });
    return { data: page.data.map((row) => this.present(row, today)), meta: page.meta };
  }

  /** Another business's task is a 404: existence must not leak. */
  async detail(actor: Actor, id: string): Promise<TaskDTO> {
    const task = await this.tasks.findInBusiness(id, actor.businessId);
    if (!task) throw AppError.notFound("Task not found");
    return this.present(task, localDay(new Date(), actor.timeZone));
  }

  async create(actor: Actor, input: CreateTaskInput): Promise<TaskDTO> {
    return runInTransaction(async (tx) => {
      const order = await this.orders.findInBusiness(input.orderId, actor.businessId, tx);
      if (!order) {
        throw AppError.unprocessable("Choose an order that exists", [{ field: "orderId", message: "Not found" }]);
      }
      if (isClosed(order.status)) throw AppError.conflict(`A ${order.status} order cannot take new tasks`);
      await this.assertAssignee(actor, input.assignedTo, tx);

      const id = await this.tasks.createTask(
        {
          businessId: actor.businessId,
          orderId: input.orderId,
          title: input.title,
          stage: input.stage,
          assignedTo: input.assignedTo ?? null,
          dueDate: input.dueDate ?? null,
          notes: input.notes ?? null,
          createdBy: actor.id,
        },
        tx,
      );
      await this.audit(actor, "task.created", id, { orderId: input.orderId, assignedTo: input.assignedTo ?? null }, tx);
      const task = (await this.tasks.findInBusiness(id, actor.businessId, tx))!;
      await this.notifyAssignee(actor, task, tx);
      return this.present(task, localDay(new Date(), actor.timeZone));
    });
  }

  async update(actor: Actor, id: string, input: UpdateTaskInput): Promise<TaskDTO> {
    return runInTransaction(async (tx) => {
      const existing = await this.lock(actor, id, tx);
      await this.assertAssignee(actor, input.assignedTo, tx);

      await this.tasks.updateTask(id, actor.businessId, input, tx);
      await this.audit(actor, "task.updated", id, { fields: Object.keys(input) }, tx);
      const task = (await this.tasks.findInBusiness(id, actor.businessId, tx))!;
      if (input.assignedTo && input.assignedTo !== existing.assignedTo) await this.notifyAssignee(actor, task, tx);
      return this.present(task, localDay(new Date(), actor.timeZone));
    });
  }

  /** Recorded with who and when, so responsibility for a delay is clear (PRD §3.8). */
  async changeStatus(actor: Actor, id: string, input: ChangeTaskStatusInput): Promise<TaskDTO> {
    return runInTransaction(async (tx) => {
      const existing = await this.lock(actor, id, tx);
      if (!canTransitionTask(existing.status, input.status)) {
        throw AppError.conflict(
          existing.status === input.status
            ? `This task is already ${taskStatusLabel(existing.status)}`
            : `A ${taskStatusLabel(existing.status)} task cannot move to ${taskStatusLabel(input.status)}`,
        );
      }

      await this.tasks.updateTask(
        id,
        actor.businessId,
        { status: input.status, completedAt: input.status === "done" ? new Date() : null },
        tx,
      );
      await this.audit(actor, "task.status_changed", id, { from: existing.status, to: input.status }, tx);
      return this.present(
        (await this.tasks.findInBusiness(id, actor.businessId, tx))!,
        localDay(new Date(), actor.timeZone),
      );
    });
  }

  private present(row: TaskRow, today: string): TaskDTO {
    return { ...row, isOverdue: isTaskOverdue(row.status, row.dueDate, today) };
  }

  private async lock(actor: Actor, id: string, tx: Tx): Promise<TaskRecord> {
    const task = await this.tasks.findForUpdate(id, actor.businessId, tx);
    if (!task) throw AppError.notFound("Task not found");
    return task;
  }

  /** Work is assigned to this business's active members only. */
  private async assertAssignee(actor: Actor, userId: string | null | undefined, tx: Tx) {
    if (!userId) return;
    const membership = await this.members.findMembership(actor.businessId, userId, tx);
    if (!membership || membership.status !== "active") {
      throw AppError.unprocessable("Choose a member of your team", [{ field: "assignedTo", message: "Not found" }]);
    }
  }

  /** Tells the person the work is theirs — in the same transaction, and not when they assigned it to themself. */
  private async notifyAssignee(actor: Actor, task: TaskRow, tx: Tx) {
    if (!task.assignedTo || task.assignedTo === actor.id) return;
    await this.notifications.notify(
      {
        businessId: actor.businessId,
        userIds: [task.assignedTo],
        type: "task.assigned",
        title: `New task: ${task.title}`,
        body: `Order ${task.orderNumber} for ${task.customerName}${task.dueDate ? ` — due ${task.dueDate}` : ""}`,
        linkPath: `/tasks/${task.id}`,
      },
      tx,
    );
  }

  private audit(actor: Actor, action: AuditAction, id: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      { businessId: actor.businessId, actorId: actor.id, action, entityType: "production_task", entityId: id, payload },
      tx,
    );
  }
}
