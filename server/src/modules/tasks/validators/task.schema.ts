import { z } from "zod";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { calendarDate, idParams, optionalText, queryBool, trimmed, uuid } from "../../../shared/utils/zod";
import { TASK_STAGES, TASK_STATUSES } from "../dto/task.dto";

export const listTasksSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(TASK_STATUSES).optional(),
    stage: z.enum(TASK_STAGES).optional(),
    orderId: uuid.optional(),
    branchId: uuid.optional(),
    assignedTo: uuid.optional(),
    /** Only the caller's own tasks. */
    mine: queryBool.optional(),
    open: queryBool.optional(),
    overdue: queryBool.optional(),
  }),
});

export const taskIdSchema = z.object({ params: idParams("id") });

export const createTaskSchema = z.object({
  body: z.object({
    orderId: uuid,
    title: trimmed(2, 150),
    stage: z.enum(TASK_STAGES).default("other"),
    assignedTo: uuid.nullable().optional(),
    dueDate: calendarDate.nullable().optional(),
    notes: optionalText(1000),
  }),
});

export const updateTaskSchema = z.object({
  params: idParams("id"),
  body: z
    .object({
      title: trimmed(2, 150),
      stage: z.enum(TASK_STAGES),
      assignedTo: uuid.nullable(),
      dueDate: calendarDate.nullable(),
      notes: optionalText(1000),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update"),
});

export const changeTaskStatusSchema = z.object({
  params: idParams("id"),
  body: z.object({ status: z.enum(TASK_STATUSES) }),
});

export type ListTasksQuery = z.infer<typeof listTasksSchema>["query"];
export type CreateTaskInput = z.infer<typeof createTaskSchema>["body"];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>["body"];
export type ChangeTaskStatusInput = z.infer<typeof changeTaskStatusSchema>["body"];
