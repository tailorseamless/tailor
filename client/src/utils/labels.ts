import type { MemberRole } from "../types/auth.types";
import type { ExpenseCategory, MaterialCategory, StockKind, TaskStage, TaskStatus } from "../types/workspace.types";
import type { Tone } from "./statusLabels";

export const ROLE: Record<MemberRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Everything, including deleting the business." },
  manager: {
    label: "Manager",
    description: "Orders, money, stock, tasks and reports. Can't change the team or business settings.",
  },
  tailor: {
    label: "Tailor",
    description: "Customers, measurements, orders and the diary. Updates tasks and stock used.",
  },
  receptionist: { label: "Receptionist", description: "Customers, orders, payments and the diary." },
  accountant: { label: "Accountant", description: "Payments, refunds, expenses and reports." },
  apprentice: { label: "Apprentice", description: "Sees the work, and updates tasks and stock used." },
};

export const TASK_STAGE: Record<TaskStage, string> = {
  cutting: "Cutting",
  sewing: "Sewing",
  fitting: "Fitting",
  alterations: "Alterations",
  finishing: "Finishing",
  other: "Other",
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  todo: { label: "To do", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  done: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Mirrors the server (tasks/domain/taskStatus): which statuses a task can move to. */
export const TASK_NEXT: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "done", "cancelled"],
  in_progress: ["todo", "done", "cancelled"],
  done: ["in_progress"],
  cancelled: ["todo"],
};

export const MATERIAL_CATEGORY: Record<MaterialCategory, string> = {
  fabric: "Fabric",
  thread: "Thread",
  button: "Buttons",
  zipper: "Zippers",
  lining: "Lining",
  interfacing: "Interfacing",
  embellishment: "Embellishment",
  other: "Other",
};

export const STOCK_KIND: Record<StockKind, string> = {
  purchase: "Bought",
  usage: "Used",
  adjustment: "Stock count",
};

export const EXPENSE_CATEGORY: Record<ExpenseCategory, string> = {
  materials: "Materials",
  rent: "Rent",
  electricity: "Electricity / fuel",
  transport: "Transport",
  wages: "Wages",
  equipment: "Equipment",
  other: "Other",
};

/** Typed keys of a label map, for building <option>s. */
export const keysOf = <K extends string>(record: Record<K, unknown>) => Object.keys(record) as K[];
