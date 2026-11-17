import { Copy, Link2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import { usePortalLink } from "../../hooks/useCustomers";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Customer } from "../../types/customer.types";
import { relative } from "../../utils/formatDate";
import { whatsappLink } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { ConfirmDialog } from "../shared/Modal";

/**
 * The customer's private page (orders, receipts, appointments). The server only shows the
 * full link once, when it's made, so a new one replaces the old.
 */
export function PortalLinkCard({ customer }: { customer: Customer }) {
  const { business, can } = useWorkspace();
  const toast = useToast();
  const { create, revoke } = usePortalLink(customer.id);
  const [url, setUrl] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const allowed = can("customer.update");

  const make = () =>
    create.mutate(undefined, {
      onSuccess: (link) => {
        setUrl(link.url);
        setConfirmNew(false);
      },
    });
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  };
  const message = url
    ? `Hi ${customer.fullName.split(" ")[0]}, track your orders and receipts from ${business.name} here: ${url}`
    : "";

  return (
    <Card title="Customer page">
      <div className="space-y-3 px-4 py-3 text-sm">
        <p className="text-fg-muted">
          A private link where {customer.fullName.split(" ")[0]} can see orders, receipts and appointments, without an
          account.
        </p>
        {url ? (
          <>
            <p className="rounded-lg bg-subtle px-3 py-2 font-mono text-xs break-all text-fg" data-cy="portal-url">
              {url}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy className="size-4" aria-hidden />}
                onClick={() => void copy()}
                data-cy="portal-copy"
              >
                Copy
              </Button>
              <a
                href={whatsappLink(message, customer.phone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#1f7a4d] px-3 text-sm font-medium text-white hover:opacity-90"
                data-cy="portal-whatsapp"
              >
                <MessageCircle className="size-4" aria-hidden /> Send on WhatsApp
              </a>
            </div>
          </>
        ) : customer.portalLinkCreatedAt ? (
          <p className="text-fg-muted">
            A link was made {relative(customer.portalLinkCreatedAt)}. For security we can't show it again; make a new
            one to share it.
          </p>
        ) : null}
        {allowed && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<Link2 className="size-4" aria-hidden />}
              loading={create.isPending}
              onClick={() => (customer.portalLinkCreatedAt && !url ? setConfirmNew(true) : make())}
              data-cy="portal-create"
            >
              {customer.portalLinkCreatedAt || url ? "Make a new link" : "Make a link"}
            </Button>
            {(customer.portalLinkCreatedAt || url) && (
              <Button
                size="sm"
                variant="ghost"
                loading={revoke.isPending}
                onClick={() => revoke.mutate(undefined, { onSuccess: () => setUrl(null) })}
                data-cy="portal-revoke"
              >
                Turn off link
              </Button>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        onConfirm={make}
        title="Make a new link?"
        message="The link you shared before will stop working."
        confirmLabel="Make new link"
        loading={create.isPending}
      />
    </Card>
  );
}
