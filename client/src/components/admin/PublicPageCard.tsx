import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useAdminActions } from "../../hooks/useOperations";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { AdminBusinessDetail } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { shopPath } from "../../utils/shopPath";
import { Button } from "../shared/Button";
import { Badge, Card, Detail } from "../shared/Display";
import { Field, FormError, Textarea, Toggle } from "../shared/Field";
import { Modal } from "../shared/Modal";

/** The server's minimum (`STOP_REASON_MIN`). */
const REASON_MIN = 10;

/**
 * Where a business may be stuck getting set up, and (for those who may act) switching things on for an owner who
 * asks. Counts and yes/no only: designs, bank numbers and measurements are never shown here.
 */
export function PublicPageCard({ detail }: { detail: AdminBusinessDetail }) {
  const { can } = useWorkspace();
  const [open, setOpen] = useState(false);
  const { business, publicPage, designVisibility: seen, counts } = detail;
  const something = seen.hidden > 0 || !publicPage.pageEnabled || !publicPage.bookingEnabled;
  const closed = business.status !== "active" || Boolean(business.deletionScheduledFor);

  return (
    <Card className="mb-5">
      <div className="space-y-3 p-4" data-cy="admin-public-page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-fg">Where they may be stuck</p>
          <Badge tone={publicPage.pageEnabled ? "success" : "warning"}>
            Public page {publicPage.pageEnabled ? "on" : "off"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Detail label="Designs switched on">{seen.showing}</Detail>
          <Detail label="Designs switched off">{seen.hidden}</Detail>
          <Detail label="Designs needing a photo">{seen.noPhoto}</Detail>
          <Detail label="Appointment requests">{publicPage.bookingEnabled ? "On" : "Off"}</Detail>
          <Detail label="Bank details">{publicPage.hasBankDetails ? "Added" : "Not added"}</Detail>
          <Detail label="Measurements recorded">{counts.measurements}</Detail>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {can("admin.manage") && something && !closed && (
            <Button size="sm" onClick={() => setOpen(true)} data-cy="admin-switch-on">
              Switch on for them
            </Button>
          )}
          {publicPage.pageEnabled && publicPage.slug && (
            <a
              href={shopPath(publicPage.slug)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-link hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden /> See their page
            </a>
          )}
        </div>
        {(!publicPage.hasBankDetails || counts.measurements === 0) && (
          <p className="text-xs text-fg-subtle">
            Bank details and measurements can only be added by the business. The app offers to help them do it.
          </p>
        )}
      </div>
      {open && <SwitchOnForThem detail={detail} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function SwitchOnForThem({ detail, onClose }: { detail: AdminBusinessDetail; onClose: () => void }) {
  const { switchOn } = useAdminActions();
  const { business, publicPage, designVisibility: seen } = detail;
  const [designs, setDesigns] = useState(seen.hidden > 0);
  const [page, setPage] = useState(!publicPage.pageEnabled);
  // Not asked for by default: it invites strangers to ask for the business's time.
  const [booking, setBooking] = useState(false);
  const [reason, setReason] = useState("");
  const pageWillBeOn = publicPage.pageEnabled || page;
  const chosen = { designs, page, booking: booking && pageWillBeOn };
  const ready = (chosen.designs || chosen.page || chosen.booking) && reason.trim().length >= REASON_MIN;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Switch on for ${business.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ready}
            loading={switchOn.isPending}
            onClick={() =>
              switchOn.mutate({ id: business.id, input: { ...chosen, reason: reason.trim() } }, { onSuccess: onClose })
            }
            data-cy="admin-switch-on-confirm"
          >
            Switch on
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={switchOn.error ? errorMessage(switchOn.error) : null} />
        <div>
          {seen.hidden > 0 && (
            <Toggle
              label={`Their ${seen.hidden} switched-off design${seen.hidden === 1 ? "" : "s"}`}
              description="All that have a photo. Some may be private on purpose, and you can't tell which."
              checked={designs}
              onChange={setDesigns}
            />
          )}
          {!publicPage.pageEnabled && (
            <Toggle
              label="Their public page"
              description="Anyone with the link will see the business name, phone, email, address, any bank account details and the designs switched on."
              checked={page}
              onChange={setPage}
            />
          )}
          {!publicPage.bookingEnabled && (
            <Toggle
              label="Appointment requests"
              description={
                pageWillBeOn ? "Visitors can ask for a time; the business accepts or declines." : "Needs their page on."
              }
              checked={chosen.booking}
              disabled={!pageWillBeOn}
              onChange={setBooking}
            />
          )}
        </div>
        <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg">
          Only do this if the business asked you to. The owner is told what you switched on.
        </p>
        <Field label="Why (kept in the audit log)" hint={`At least ${REASON_MIN} characters.`}>
          {(p) => (
            <Textarea
              {...p}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Owner asked for help on WhatsApp"
              data-cy="admin-switch-on-reason"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
