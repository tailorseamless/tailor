import { Pencil } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTaskActions } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Task, TaskStatus } from "../../types/workspace.types";
import { cn } from "../../utils/cn";
import { formatDay } from "../../utils/formatDate";
import { TASK_NEXT, TASK_STAGE, TASK_STATUS } from "../../utils/labels";
import { IconButton } from "../shared/Button";
import { TaskForm } from "./TaskForm";

/** Tasks with an inline status picker; used on the Tasks page and an order's page. */
export function TaskList({
  tasks,
  showOrder = true,
  highlight,
}: {
  tasks: Task[];
  showOrder?: boolean;
  highlight?: string;
}) {
  const { can } = useWorkspace();
  const { setStatus } = useTaskActions();
  const [editing, setEditing] = useState<Task | null>(null);
  const canManage = can("task.manage");

  return (
    <>
      <ul className="divide-y divide-line">
        {tasks.map((t) => {
          const canMove = can("task.status");
          return (
            <li
              key={t.id}
              className={cn("flex flex-wrap items-center gap-3 px-4 py-3", highlight === t.id && "bg-brand-soft/50")}
              data-cy="task-row"
            >
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium text-fg", t.status === "done" && "text-fg-subtle line-through")}>
                  {t.title}
                </p>
                <p className="text-xs text-fg-muted">
                  {TASK_STAGE[t.stage]}
                  {showOrder && (
                    <>
                      {" · "}
                      <Link to={`/orders/${t.orderId}`} className="text-link hover:underline">
                        {t.orderNumber} · {t.customerName}
                      </Link>
                    </>
                  )}
                  {" · "}
                  {t.assignedName ?? "Not assigned"}
                  {t.dueDate && (
                    <span className={t.isOverdue ? "font-medium text-danger-fg" : undefined}>
                      {" · "}
                      {t.isOverdue ? "Overdue " : "Due "}
                      {formatDay(t.dueDate)}
                    </span>
                  )}
                </p>
                {t.notes && <p className="mt-0.5 text-xs text-fg-subtle">{t.notes}</p>}
              </div>
              <select
                className="control w-auto py-1 text-sm"
                value={t.status}
                disabled={!canMove || setStatus.isPending}
                onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value as TaskStatus })}
                aria-label={`Status of ${t.title}`}
                data-cy="task-status"
              >
                {[t.status, ...TASK_NEXT[t.status]].map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS[s].label}
                  </option>
                ))}
              </select>
              {canManage && (
                <IconButton label={`Edit ${t.title}`} onClick={() => setEditing(t)} data-cy="task-edit">
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
      {editing && <TaskForm task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
