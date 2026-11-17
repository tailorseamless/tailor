import { Plus } from "lucide-react";
import { useState } from "react";
import { useTasks } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { QueryState } from "../shared/States";
import { TaskForm } from "../tasks/TaskForm";
import { TaskList } from "../tasks/TaskList";

export function OrderTasksCard({ orderId, closed }: { orderId: string; closed: boolean }) {
  const { can } = useWorkspace();
  const query = useTasks({ orderId, limit: 50 });
  const [adding, setAdding] = useState(false);
  return (
    <Card
      title="Tasks"
      action={
        can("task.manage") &&
        !closed && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setAdding(true)}
            data-cy="order-task-new"
          >
            Task
          </Button>
        )
      }
    >
      <QueryState query={query}>
        {({ data }) =>
          data.length ? (
            <TaskList tasks={data} showOrder={false} />
          ) : (
            <p className="px-4 py-6 text-center text-sm text-fg-subtle">No tasks yet.</p>
          )
        }
      </QueryState>
      {adding && <TaskForm orderId={orderId} onClose={() => setAdding(false)} />}
    </Card>
  );
}
