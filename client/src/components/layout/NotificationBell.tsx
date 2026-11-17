import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useUnreadCount } from "../../hooks/useAccount";
import { useWorkspace } from "../../hooks/useWorkspace";

export function NotificationBell() {
  const { can } = useWorkspace();
  const allowed = can("notification.read");
  const unread = useUnreadCount(allowed).data?.unread ?? 0;
  if (!allowed) return null;
  return (
    <Link
      to="/notifications"
      className="relative inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      data-cy="notification-bell"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger-solid px-1 text-[10px] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
