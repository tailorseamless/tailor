import type { RequestContext } from "../../../shared/context/requestContext";
import type { ActorKind, AuditAction, AuditInput } from "../dto/activity.dto";

/** Pure rules for the audit trail — no I/O (Backend Guide §27). */

/**
 * Who acted, when the caller didn't say:
 * - `admin.*` actions are a platform admin's;
 * - anything else with an actor is a signed-in person's;
 * - with no actor: a customer's portal link, the public pages, or (outside any request) a job.
 */
export function actorKindFor(
  entry: Pick<AuditInput, "action" | "actorId" | "actorKind">,
  context: Pick<RequestContext, "path"> | undefined,
  apiPrefix: string,
): ActorKind {
  if (entry.actorKind) return entry.actorKind;
  if (entry.action.startsWith("admin.")) return "admin";
  if (entry.actorId) return "user";
  if (!context) return "system";
  if (context.path.startsWith(`${apiPrefix}/portal/`)) return "portal";
  if (context.path.startsWith(`${apiPrefix}/public/`)) return "public";
  return "system";
}

/**
 * What the platform activity feed shows: moments in a business's life on the platform (joining,
 * growing the team, leaving) and what platform admins did. Not the day-to-day work inside a
 * business (customers, orders, payments): that is the business's own, and would drown the feed.
 */
export const FEED_ACTIONS = [
  "business.registered",
  "account.linked",
  "team.member_added",
  "team.member_removed",
  "business.deletion_requested",
  "business.deletion_cancelled",
  "business.deleted",
  "account.deletion_requested",
  "account.deleted",
  "admin.business_suspended",
  "admin.business_reactivated",
  "admin.switched_on",
  "admin.user_disabled",
  "admin.user_enabled",
  "admin.role_granted",
  "admin.role_revoked",
  "admin.alert_resolved",
  "admin.announcement_created",
] as const satisfies readonly AuditAction[];

/**
 * The audit view pages by position, not by number (it is the largest table and grows forever):
 * the cursor is the last row's exact timestamp (as Postgres prints it, microseconds and all) and id.
 */
export function encodeAuditCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The position a cursor points at, or null when it isn't one of ours. */
export function decodeAuditCursor(cursor: string): { createdAt: string; id: string } | null {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const split = decoded.lastIndexOf("|");
  if (split <= 0) return null;
  const createdAt = decoded.slice(0, split);
  const id = decoded.slice(split + 1);
  if (!UUID.test(id) || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}
