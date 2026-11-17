import { Bell } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/shared/Button";
import { Card, FilterChips, PageHeader } from "../components/shared/Display";
import { EmptyState, QueryState } from "../components/shared/States";
import { useMarkRead, useNotifications } from "../hooks/useAccount";
import { cn } from "../utils/cn";
import { relative } from "../utils/formatDate";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useNotifications(unreadOnly);
  const { read, readAll } = useMarkRead();

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button
            variant="secondary"
            loading={readAll.isPending}
            onClick={() => readAll.mutate(undefined)}
            data-cy="notifications-read-all"
          >
            Mark all read
          </Button>
        }
      />
      <div className="mb-4">
        <FilterChips
          label="Show"
          value={unreadOnly ? "unread" : "all"}
          onChange={(v) => setUnreadOnly(v === "unread")}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
          ]}
        />
      </div>
      <Card>
        <QueryState query={query}>
          {({ data }) =>
            data.length ? (
              <ul className="divide-y divide-line">
                {data.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left hover:bg-subtle",
                        !n.readAt && "bg-brand-soft/40",
                      )}
                      onClick={() => {
                        if (!n.readAt) read.mutate(n.id);
                        if (n.linkPath?.startsWith("/")) navigate(n.linkPath);
                      }}
                      data-cy="notification-row"
                    >
                      <span
                        className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm text-fg", !n.readAt && "font-medium")}>{n.title}</span>
                        {n.body && <span className="block text-sm text-fg-muted">{n.body}</span>}
                        <span className="block text-xs text-fg-subtle">{relative(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Bell className="size-6" aria-hidden />}
                title={unreadOnly ? "You're all caught up" : "No notifications yet"}
              />
            )
          }
        </QueryState>
      </Card>
    </>
  );
}
