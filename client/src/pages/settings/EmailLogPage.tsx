import { Mail } from "lucide-react";
import { useState } from "react";
import { Badge, Card, FilterChips, PageHeader, Pagination } from "../../components/shared/Display";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useOutbox } from "../../hooks/useAccount";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { OutboxEmail } from "../../types/dashboard.types";
import { formatDateTime } from "../../utils/formatDate";
import type { Tone } from "../../utils/statusLabels";

const KIND: Record<OutboxEmail["kind"], string> = {
  "team.invitation": "Team invitation",
  "appointment.reminder": "Appointment reminder",
  receipt: "Receipt",
  "appointment.request_received": "Booking request received",
  "appointment.request_decided": "Booking reply",
  notification: "Notification",
  "order.status": "Order update",
};

const STATUS: Record<OutboxEmail["status"], { label: string; tone: Tone }> = {
  pending: { label: "Waiting", tone: "info" },
  sent: { label: "Sent", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Not sent", tone: "neutral" },
};

/** Every email Tailor Seamless sent (or tried to send) for this business. */
export default function EmailLogPage() {
  const { timeZone } = useWorkspace();
  const [status, setStatus] = useState<"all" | OutboxEmail["status"]>("all");
  const [page, setPage] = useState(1);
  const query = useOutbox({ status: status === "all" ? undefined : status, page });

  return (
    <>
      <PageHeader
        back={{ to: "/settings", label: "Settings" }}
        title="Email log"
        subtitle="Invitations, reminders and receipts sent from Tailor Seamless."
      />
      {query.data && !query.data.emailEnabled && (
        <p role="status" className="mb-4 rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          Sending email isn't set up on the server yet, so emails wait here unsent.
        </p>
      )}
      <div className="mb-4">
        <FilterChips
          label="Show"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "failed", label: "Failed" },
            { value: "pending", label: "Waiting" },
            { value: "sent", label: "Sent" },
          ]}
        />
      </div>
      <Card>
        <QueryState query={query}>
          {(res) =>
            res.data?.length ? (
              <>
                <ul className="divide-y divide-line">
                  {res.data.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-3" data-cy="email-row">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">{KIND[e.kind] ?? e.kind}</p>
                        <p className="truncate text-xs text-fg-muted">
                          To {e.toAddress} · {formatDateTime(e.sentAt ?? e.createdAt, timeZone)}
                          {e.attempts > 1 && ` · ${e.attempts} tries`}
                        </p>
                        {e.status === "failed" && e.lastError && (
                          <p className="mt-1 text-xs text-danger-fg">{e.lastError}</p>
                        )}
                      </div>
                      <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                    </li>
                  ))}
                </ul>
                <Pagination meta={res.meta ?? null} onPage={setPage} />
              </>
            ) : (
              <EmptyState icon={<Mail className="size-6" aria-hidden />} title="No emails here" />
            )
          }
        </QueryState>
      </Card>
    </>
  );
}
