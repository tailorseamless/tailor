import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";
import { TASK_STAGES, TASK_STATUSES, type TaskStage, type TaskStatus } from "../dto/task.dto";

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(",");

/**
 * A piece of work needed to fulfil an order — separate from the order itself,
 * so one order can have several garments and several people on it (PRD §18.3).
 */
@Entity("production_tasks")
@Index(["businessId", "status", "dueDate"]) // the work board
@Index(["businessId", "assignedTo", "status"]) // one person's work
@Index(["orderId"]) // an order's tasks
@Check(`"stage" IN (${list(TASK_STAGES)})`)
@Check(`"status" IN (${list(TASK_STATUSES)})`)
export class ProductionTask extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @ForeignKey("Order", "order_id", "RESTRICT")
  order?: unknown;

  @Column({ type: "varchar", length: 150 })
  title: string;

  @Column({ type: "varchar", length: 20, default: "other" })
  stage: TaskStage;

  @Column({ type: "varchar", length: 20, default: "todo" })
  status: TaskStatus;

  @Column({ name: "assigned_to", type: "uuid", nullable: true })
  assignedTo: string | null;

  @ForeignKey("User", "assigned_to", "SET NULL")
  assignee?: unknown;

  @Column({ name: "due_date", type: "date", nullable: true })
  dueDate: string | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy: string | null;

  @ForeignKey("User", "created_by", "SET NULL")
  creator?: unknown;
}
