import { useState } from "react";
import { useAdminAnnouncementActions, useAdminAnnouncements } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Announcement, AnnouncementAudience } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { formatDateTime } from "../../utils/formatDate";
import { Button } from "../shared/Button";
import { Badge, Card } from "../shared/Display";
import { Field, FormError, Input, Select, Textarea } from "../shared/Field";
import { ConfirmDialog } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";

const AUDIENCE: Record<AnnouncementAudience, string> = {
  owners: "Business owners",
  everyone: "Everyone on every team",
};

const STATUS: Record<Announcement["status"], { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  queued: { label: "Queued", tone: "info" },
  sending: { label: "Sending", tone: "info" },
  sent: { label: "Sent", tone: "success" },
  cancelled: { label: "Cancelled", tone: "warning" },
};

/**
 * Messages from Tailor Seamless to the businesses: an in-app notification (and push, for people who
 * allow it), delivered 50 businesses a minute. People can turn announcements off in their settings.
 */
export function AnnouncementsPanel() {
  const { timeZone, can } = useWorkspace();
  const manage = can("admin.manage");
  const list = useAdminAnnouncements();
  const { create, cancel } = useAdminAnnouncementActions();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkPath, setLinkPath] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("owners");
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const review = () => {
    setProblem(null);
    if (title.trim().length < 3) return setProblem("Give it a title.");
    if (body.trim().length < 3) return setProblem("Write the message.");
    if (linkPath.trim() && !/^\/(?![/\\])\S*$/.test(linkPath.trim()))
      return setProblem("The link must be a page in the app, like /settings.");
    setConfirming(true);
  };

  const send = () =>
    create.mutate(
      { title: title.trim(), body: body.trim(), linkPath: linkPath.trim() || null, audience },
      {
        onSuccess: () => {
          setConfirming(false);
          setTitle("");
          setBody("");
          setLinkPath("");
        },
        onError: () => setConfirming(false),
      },
    );

  return (
    <div className="space-y-5">
      {manage && (
        <Card title="New announcement">
          <div className="space-y-4 p-4">
            <FormError message={problem ?? (create.error ? errorMessage(create.error) : null)} />
            <Field label="Title">
              {(p) => (
                <Input
                  {...p}
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  data-cy="announcement-title"
                />
              )}
            </Field>
            <Field label="Message">
              {(p) => (
                <Textarea
                  {...p}
                  value={body}
                  maxLength={1000}
                  rows={4}
                  onChange={(e) => setBody(e.target.value)}
                  data-cy="announcement-body"
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link (optional)" hint="A page in the app it opens, e.g. /settings.">
                {(p) => (
                  <Input
                    {...p}
                    value={linkPath}
                    placeholder="/settings"
                    onChange={(e) => setLinkPath(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Send to">
                {(p) => (
                  <Select {...p} value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}>
                    <option value="owners">{AUDIENCE.owners}</option>
                    <option value="everyone">{AUDIENCE.everyone}</option>
                  </Select>
                )}
              </Field>
            </div>
            <div className="flex justify-end">
              <Button onClick={review} data-cy="announcement-review">
                Review and send
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Sent and scheduled">
        <QueryState query={list}>
          {(items) =>
            items.length ? (
              <ul className="divide-y divide-line">
                {items.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3" data-cy="announcement">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{a.title}</p>
                      <p className="text-sm whitespace-pre-wrap text-fg-muted">{a.body}</p>
                      <p className="text-xs text-fg-subtle">
                        {AUDIENCE[a.audience]} · {formatDateTime(a.createdAt, timeZone)}
                        {a.author && ` · by ${a.author.fullName}`} · {a.recipients} people in {a.businessesReached}{" "}
                        businesses
                        {a.linkPath && ` · opens ${a.linkPath}`}
                      </p>
                    </div>
                    <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                    {manage && (a.status === "queued" || a.status === "sending") && (
                      <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(a.id)}>
                        Stop
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No announcements yet" />
            )
          }
        </QueryState>
      </Card>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={send}
        title={`Send "${title.trim()}"?`}
        message={`It goes to ${AUDIENCE[audience].toLowerCase()} of every active business, in the app and by push. It can be stopped while it is sending, but not taken back from those who already have it.`}
        confirmLabel="Send announcement"
        loading={create.isPending}
      />
    </div>
  );
}
