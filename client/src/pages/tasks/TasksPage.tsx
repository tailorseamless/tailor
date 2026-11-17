import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { TaskForm } from "../../components/tasks/TaskForm";
import { TaskList } from "../../components/tasks/TaskList";
import { Button } from "../../components/shared/Button";
import { Card, FilterChips, PageHeader, Pagination } from "../../components/shared/Display";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useTask, useTasks } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { TaskFilters } from "../../types/workspace.types";

const filters = {
  mine: { label: "Mine", params: { mine: true, open: true } },
  open: { label: "Open", params: { open: true } },
  overdue: { label: "Overdue", params: { overdue: true } },
  done: { label: "Done", params: { status: "done" } },
  all: { label: "All", params: {} },
} satisfies Record<string, { label: string; params: TaskFilters }>;
type FilterKey = keyof typeof filters;

export default function TasksPage() {
  const { id } = useParams();
  const { can } = useWorkspace();
  const canManage = can("task.manage");
  const [filter, setFilter] = useState<FilterKey>(canManage ? "open" : "mine");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const query = useTasks({ ...(filters[filter].params as TaskFilters), page, limit: 30 });
  // Opened from a notification or email: show that task on top, whatever the filter.
  const linked = useTask(id);

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Workshop jobs on each order, and who's doing them."
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)} data-cy="task-new">
              New task
            </Button>
          )
        }
      />
      {linked.data && (
        <Card className="mb-4" title="Task you opened">
          <TaskList tasks={[linked.data]} highlight={linked.data.id} />
        </Card>
      )}
      <div className="mb-4">
        <FilterChips
          label="Show"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={(Object.keys(filters) as FilterKey[]).map((k) => ({ value: k, label: filters[k].label }))}
        />
      </div>
      <Card>
        <QueryState query={query} loadingLabel="Loading tasks">
          {({ data, meta }) =>
            data.length ? (
              <>
                <TaskList tasks={data} />
                <Pagination meta={meta} onPage={setPage} />
              </>
            ) : (
              <EmptyState
                icon={<ListChecks className="size-6" aria-hidden />}
                title={filter === "mine" ? "Nothing on your list" : "No tasks here"}
                message={
                  canManage
                    ? "Break orders into jobs (cutting, sewing, fitting) and give them to your team."
                    : undefined
                }
              />
            )
          }
        </QueryState>
      </Card>
      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </>
  );
}
