import { useState } from "react";
import { useAddAdminNote, useAdminNotes } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import { formatDateTime } from "../../utils/formatDate";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { Textarea } from "../shared/Field";
import { QueryState } from "../shared/States";

/**
 * Platform admins' notes about a business ("called the owner about failed emails"). Only platform
 * admins see them; the business never does. Notes can't be edited: add another to correct one.
 */
export function AdminNotesCard({ businessId }: { businessId: string }) {
  const { timeZone } = useWorkspace();
  const notes = useAdminNotes(businessId);
  const add = useAddAdminNote(businessId);
  const [body, setBody] = useState("");

  return (
    <Card title="Admin notes">
      <div className="space-y-3 p-4">
        <p className="text-xs text-fg-muted">Seen by platform admins only, never by the business.</p>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          aria-label="New note"
          placeholder="What happened, what you agreed, what to check next…"
          data-cy="admin-note-input"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!body.trim()}
            loading={add.isPending}
            onClick={() => add.mutate(body.trim(), { onSuccess: () => setBody("") })}
            data-cy="admin-note-add"
          >
            Add note
          </Button>
        </div>
      </div>
      <QueryState query={notes}>
        {(list) =>
          list.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {list.map((note) => (
                <li key={note.id} className="px-4 py-3">
                  <p className="text-sm whitespace-pre-wrap text-fg">{note.body}</p>
                  <p className="text-xs text-fg-subtle">
                    {note.author?.fullName ?? "A former admin"} · {formatDateTime(note.createdAt, timeZone)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null
        }
      </QueryState>
    </Card>
  );
}
