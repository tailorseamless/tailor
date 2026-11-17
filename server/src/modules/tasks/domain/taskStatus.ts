import type { TaskStatus } from "../dto/task.dto";

/** The task lifecycle — pure rules, no I/O (Backend Guide §27.3). */

const NEXT: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["in_progress", "done", "cancelled"],
  in_progress: ["todo", "done", "cancelled"],
  done: ["in_progress"], // reopened: the work needs redoing
  cancelled: ["todo"], // restored
};

export const canTransitionTask = (from: TaskStatus, to: TaskStatus): boolean => NEXT[from].includes(to);

export const isOpenTask = (status: TaskStatus): boolean => status === "todo" || status === "in_progress";

export const isTaskOverdue = (status: TaskStatus, dueDate: string | null, today: string): boolean =>
  dueDate !== null && dueDate < today && isOpenTask(status);

export const taskStatusLabel = (status: TaskStatus): string => status.replace(/_/g, " ");
