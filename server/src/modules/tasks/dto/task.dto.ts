/** The kind of work, matching the production stages of an order (PRD §3.4). */
export const TASK_STAGES = ["cutting", "sewing", "fitting", "alterations", "finishing", "other"] as const;
export type TaskStage = (typeof TASK_STAGES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskRecord {
  id: string;
  businessId: string;
  orderId: string;
  title: string;
  stage: TaskStage;
  status: TaskStatus;
  /** Who does the work, if decided. */
  assignedTo: string | null;
  /** `YYYY-MM-DD` */
  dueDate: string | null;
  notes: string | null;
  completedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDTO extends TaskRecord {
  orderNumber: string;
  customerName: string;
  assignedName: string | null;
  /** Past its due date and not finished. */
  isOverdue: boolean;
}

export interface ListTasksParams {
  businessId: string;
  page: number;
  limit: number;
  status?: TaskStatus;
  stage?: TaskStage;
  orderId?: string;
  /** Tasks on orders of this branch. */
  branchId?: string;
  assignedTo?: string;
  /** Only tasks not yet done or cancelled. */
  open?: boolean;
  /** Only open tasks past their due date. */
  overdue?: boolean;
  /** "Today" where the caller is, `YYYY-MM-DD`. */
  today: string;
}
