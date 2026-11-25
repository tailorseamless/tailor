import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import { useAdminAuditLogs } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { AuditActorKind, AuditEntry, AuditFilters } from "../../types/workspace.types";
import { formatDateTime } from "../../utils/formatDate";
import { Button } from "../shared/Button";
import { Badge, Card, FilterChips } from "../shared/Display";
import { Field, Input } from "../shared/Field";
import { EmptyState, QueryState } from "../shared/States";

const ACTOR_LABEL: Record<AuditActorKind, string> = {
  user: "Person",
  admin: "Platform admin",
  system: "System",
  portal: "Customer portal",
  public: "Public page",
};

const ACTION_PATTERN = /^[a-z_]+\.([a-z_]+)?$/;

/** Who did it, in words: their name when there is one, otherwise what kind of actor. */
function actorName(entry: AuditEntry): string {
  if (entry.actor) return entry.actor.fullName || entry.actor.email;
  return ACTOR_LABEL[entry.actorKind];
}

function AuditRow({ entry, timeZone, onBusiness }: { entry: AuditEntry; timeZone: string; onBusiness: () => void }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <li className="px-4 py-3" data-cy="audit-entry">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          className="mt-0.5 text-fg-subtle hover:text-fg"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Hide details" : "Show details"}
        >
          <Chevron className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">
            <span className="font-mono text-xs">{entry.action}</span>
            <span className="text-fg-muted"> by </span>
            <span className="font-medium">{actorName(entry)}</span>
            {entry.actor && entry.actorKind === "admin" && <span className="text-fg-subtle"> (platform admin)</span>}
          </p>
          <p className="text-xs text-fg-muted">
            {formatDateTime(entry.createdAt, timeZone)}
            {entry.business ? (
              <>
                {" · "}
                <button type="button" className="underline-offset-2 hover:underline" onClick={onBusiness}>
                  {entry.business.name}
                </button>
              </>
            ) : (
              " · Platform"
            )}
            {entry.ip && ` · ${entry.ip}`}
          </p>
        </div>
        {entry.outcome !== "success" && <Badge tone="danger">{entry.outcome}</Badge>}
      </div>
      {open && (
        <dl className="mt-3 ml-7 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
          <dt className="text-fg-subtle">Record</dt>
          <dd className="font-mono break-all text-fg">
            {entry.entityType}
            {entry.entityId && ` ${entry.entityId}`}
          </dd>
          {entry.actor && (
            <>
              <dt className="text-fg-subtle">Actor</dt>
              <dd className="break-all text-fg">{entry.actor.email}</dd>
            </>
          )}
          <dt className="text-fg-subtle">Request</dt>
          <dd className="font-mono break-all text-fg">{entry.requestId ?? "None (a job or a script)"}</dd>
          {entry.userAgent && (
            <>
              <dt className="text-fg-subtle">Device</dt>
              <dd className="break-all text-fg">{entry.userAgent}</dd>
            </>
          )}
          <dt className="text-fg-subtle">Details</dt>
          <dd>
            <pre className="overflow-x-auto rounded-md bg-subtle p-2 font-mono text-fg">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </dd>
        </dl>
      )}
    </li>
  );
}

/**
 * The raw audit trail across every business: who did what, when, from where. Newest first; "Older" walks
 * back page by page (the server pages by position, so there are no page numbers).
 */
export function AuditLogPanel({
  business,
  onBusiness,
}: {
  /** Show only this business's entries. */
  business: { id: string; name: string } | null;
  onBusiness: (business: { id: string; name: string } | null) => void;
}) {
  const { timeZone } = useWorkspace();
  const [actorKind, setActorKind] = useState<AuditActorKind | "all">("all");
  const [actionTerm, setActionTerm] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Cursors of the pages already seen, so "Newer" can step back.
  const [cursors, setCursors] = useState<string[]>([]);
  const action = useDebounce(actionTerm.trim().toLowerCase(), 400);
  const actionValid = !action || ACTION_PATTERN.test(action);

  const filters: AuditFilters = {
    cursor: cursors.at(-1),
    businessId: business?.id,
    actorKind: actorKind === "all" ? undefined : actorKind,
    action: action && actionValid ? action : undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const entries = useAdminAuditLogs(filters);
  const reset = () => setCursors([]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <FilterChips
          label="Who"
          value={actorKind}
          onChange={(v) => {
            setActorKind(v);
            reset();
          }}
          options={[
            { value: "all", label: "Everyone" },
            { value: "admin", label: "Platform admins" },
            { value: "user", label: "People" },
            { value: "system", label: "System" },
            { value: "portal", label: "Portal" },
            { value: "public", label: "Public" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Action"
            hint="Exact (payment.voided) or a whole area (payment.)"
            error={actionValid ? undefined : "Write it like payment.voided or payment."}
          >
            {(p) => (
              <Input
                {...p}
                value={actionTerm}
                placeholder="admin."
                onChange={(e) => {
                  setActionTerm(e.target.value);
                  reset();
                }}
                data-cy="audit-action"
              />
            )}
          </Field>
          <Field label="From">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  reset();
                }}
              />
            )}
          </Field>
          <Field label="Before">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  reset();
                }}
              />
            )}
          </Field>
        </div>
        {business && (
          <div>
            <Badge tone="neutral">
              <span className="inline-flex items-center gap-1">
                {business.name}
                <button
                  type="button"
                  aria-label="Show every business"
                  onClick={() => {
                    onBusiness(null);
                    reset();
                  }}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </Badge>
          </div>
        )}
      </div>
      <Card>
        <QueryState query={entries}>
          {({ data, meta }) =>
            data.length ? (
              <>
                <ul className="divide-y divide-line">
                  {data.map((entry) => (
                    <AuditRow
                      key={entry.id}
                      entry={entry}
                      timeZone={timeZone}
                      onBusiness={() => {
                        if (entry.business) onBusiness(entry.business);
                        reset();
                      }}
                    />
                  ))}
                </ul>
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
                    data-cy="audit-older"
                  >
                    Older
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState title="Nothing recorded matches" />
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
