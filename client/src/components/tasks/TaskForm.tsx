import { useState } from "react";
import { useTaskActions } from "../../hooks/useOperations";
import { useOrders } from "../../hooks/useOrders";
import { useTeam } from "../../hooks/useTeam";
import type { Task, TaskStage } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { keysOf, TASK_STAGE } from "../../utils/labels";
import { orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { DatePicker } from "../shared/DatePicker";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import { Modal } from "../shared/Modal";

interface Props {
  onClose: () => void;
  task?: Task;
  /** Fixes the order (when adding from an order's page). */
  orderId?: string;
}

/** Give a piece of work on an order to someone. */
export function TaskForm({ onClose, task, orderId }: Props) {
  const { create, update } = useTaskActions();
  const mutation = task ? update : create;
  const team = useTeam({ limit: 100 });
  const orders = useOrders({ unfinished: true, sort: "due", limit: 100 }, !task && !orderId);
  const [order, setOrder] = useState(orderId ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [stage, setStage] = useState<TaskStage>(task?.stage ?? "sewing");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const people = (team.data?.data ?? []).filter((m) => m.status === "active");

  const save = () => {
    setProblem(null);
    if (!task && !order) return setProblem("Choose the order this is for.");
    if (title.trim().length < 2) return setProblem("Say what needs doing.");
    const body = {
      title: title.trim(),
      stage,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      notes: orNull(notes),
    };
    if (task) update.mutate({ id: task.id, input: body }, { onSuccess: onClose });
    else create.mutate({ orderId: order, ...body }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="task-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={mutation.isPending} data-cy="task-save">
            {task ? "Save" : "Add task"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        {!task && !orderId && (
          <Field label="Order">
            {(p) => (
              <Select {...p} value={order} onChange={(e) => setOrder(e.target.value)} data-cy="task-order">
                <option value="">Choose an order…</option>
                {(orders.data?.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} · {o.customerName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="What needs doing">
          {(p) => (
            <Input
              {...p}
              placeholder="e.g. Cut the agbada fabric"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-cy="task-title"
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Stage">
            {(p) => (
              <Select {...p} value={stage} onChange={(e) => setStage(e.target.value as TaskStage)} data-cy="task-stage">
                {keysOf(TASK_STAGE).map((s) => (
                  <option key={s} value={s}>
                    {TASK_STAGE[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Who">
            {(p) => (
              <Select {...p} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} data-cy="task-assignee">
                <option value="">Not assigned</option>
                {people.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Due (optional)">
            {(p) => <DatePicker {...p} value={dueDate} onChange={setDueDate} data-cy="task-due" />}
          </Field>
        </div>
        <Field label="Notes (optional)">
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              data-cy="task-notes"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
