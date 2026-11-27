import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminActivity } from "../../hooks/useOperations";
import type { ActivityItem } from "../../types/workspace.types";
import { relative } from "../../utils/formatDate";
import { Button } from "../shared/Button";
import { EmptyState, QueryState } from "../shared/States";

/** The feed in words. Business names are shown beside each line, so sentences don't repeat them. */
function sentence(item: ActivityItem): string {
  const who = item.actorName ?? (item.actorKind === "system" ? "The system" : "Someone");
  switch (item.action) {
    case "business.registered":
      return `${who} created a business`;
    case "account.linked":
      return `${who} accepted their team invitation`;
    case "team.member_added":
      return `${who} invited a new team member`;
    case "team.member_removed":
      return `${who} removed a team member`;
    case "business.deletion_requested":
      return `${who} asked to delete the business`;
    case "business.deletion_cancelled":
      return `${who} cancelled deleting the business`;
    case "business.deleted":
      return "The business was deleted (anonymised)";
    case "account.deletion_requested":
      return `${who} asked to delete their account`;
    case "account.deleted":
      return "An account was deleted (anonymised)";
    case "admin.business_suspended":
      return `${who} suspended the business`;
    case "admin.business_reactivated":
      return `${who} reactivated the business`;
    case "admin.switched_on":
      return `${who} switched things on for the business`;
    case "admin.user_disabled":
      return `${who} disabled an account`;
    case "admin.user_enabled":
      return `${who} enabled an account`;
    case "admin.role_granted":
      return "Platform admin access was granted";
    case "admin.role_revoked":
      return "Platform admin access was removed";
    case "admin.ai_tokens_granted":
      return `${who} changed the business's AI tokens`;
    case "admin.alert_resolved":
      return `${who} resolved an alert`;
    default:
      return `${who}: ${item.action}`;
  }
}

/**
 * What is happening across the platform (or in one business): joins, team changes, departures and
 * what platform admins did. Newest first; "Show older" walks back.
 */
export function ActivityFeed({ businessId, limit = 30 }: { businessId?: string; limit?: number }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const feed = useAdminActivity({ businessId, limit, cursor: cursors.at(-1) });
  return (
    <QueryState query={feed}>
      {({ data, meta }) =>
        data.length ? (
          <>
            <ul className="divide-y divide-line">
              {data.map((item) => (
                <li key={item.id} className="px-4 py-3" data-cy="activity-item">
                  <p className="text-sm text-fg">{sentence(item)}</p>
                  <p className="text-xs text-fg-muted">
                    {relative(item.createdAt)}
                    {item.business && !businessId && (
                      <>
                        {" · "}
                        <Link to={`/admin/businesses/${item.business.id}`} className="hover:underline">
                          {item.business.name}
                        </Link>
                      </>
                    )}
                    {!item.business && " · Platform"}
                  </p>
                </li>
              ))}
            </ul>
            {(cursors.length > 0 || meta?.nextCursor) && (
              <div className="flex justify-between gap-3 border-t border-line px-4 py-3">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={cursors.length === 0}
                  onClick={() => setCursors(cursors.slice(0, -1))}
                >
                  Newer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!meta?.nextCursor}
                  onClick={() => meta?.nextCursor && setCursors([...cursors, meta.nextCursor])}
                >
                  Older
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="Nothing has happened yet" />
        )
      }
    </QueryState>
  );
}
