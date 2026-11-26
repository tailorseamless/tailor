import { Check, CheckCircle2, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useDesignVisibility } from "../../hooks/useDesignVisibility";
import { useNotNow } from "../../hooks/useNotNow";
import { useSharePage } from "../../hooks/useSharePage";
import { useShowDesigns } from "../../hooks/useTeam";
import { useWorkspace } from "../../hooks/useWorkspace";
import { cn } from "../../utils/cn";
import { errorMessage } from "../../utils/errors";
import { shopPath, shopUrl } from "../../utils/shopPath";
import { whatsappLink } from "../../utils/validation";
import { Button, buttonClass } from "../shared/Button";
import { FormError } from "../shared/Field";
import { Modal } from "../shared/Modal";
import { Spinner } from "../shared/States";

const many = (n: number) => `${n} design${n === 1 ? "" : "s"}`;

/**
 * Does the work of getting designs seen: the person checks the pictures and taps one button, and the app switches
 * the designs on and (for the owner) publishes the page. Nothing becomes visible without that tap.
 * `only` narrows it to particular designs, e.g. the one just added.
 */
export function ShowDesignsDialog({ only, onClose }: { only?: string[]; onClose: () => void }) {
  const { business } = useWorkspace();
  const status = useDesignVisibility();
  const { kept, keep, forget } = useNotNow();
  const mutation = useShowDesigns();
  const { copy } = useSharePage();
  // Only what the person has tapped; until then a design is ticked unless they kept it private before.
  const [choice, setChoice] = useState<Record<string, boolean>>({});

  const candidates = only ? status.hidden.filter((d) => only.includes(d.id)) : status.hidden;
  const ticked = (id: string) => choice[id] ?? (only ? true : !kept.has(id));
  const ids = candidates.filter((d) => ticked(d.id)).map((d) => d.id);
  const publish = !status.pageOn && status.canPublish;
  // Not while saving: the page shows as on before the result is in.
  const nothingToDo = !mutation.isPending && !publish && candidates.length === 0;

  const confirm = () => {
    forget([...ids, "page"]);
    keep(candidates.filter((d) => !ticked(d.id)).map((d) => d.id));
    mutation.mutate({ ids, publish });
  };

  const notNow = () => {
    keep([...candidates.map((d) => d.id), ...(publish ? ["page"] : [])]);
    onClose();
  };

  if (mutation.isSuccess) {
    const link = business.pageEnabled && business.slug ? shopUrl(business.slug) : null;
    return (
      <Modal
        open
        onClose={onClose}
        title="Done"
        footer={
          <Button onClick={onClose} data-cy="show-designs-done">
            Close
          </Button>
        }
      >
        <div className="space-y-4" data-cy="show-designs-success">
          <p className="flex items-start gap-2 text-fg" role="status">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-fg" aria-hidden />
            {link
              ? "People can now see your designs. Send them your link:"
              : "Switched on. Your customers can see these on their private pages. To let everyone see them, ask the business owner to switch on your public page."}
          </p>
          {link && business.slug && (
            <>
              <p className="rounded-lg bg-subtle px-3 py-2 text-sm break-all text-fg">{link}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <a
                  href={whatsappLink(`${business.name}: see our designs and prices — ${link}`)}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("primary")}
                  data-cy="show-designs-whatsapp"
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
                <Button
                  variant="secondary"
                  icon={<Copy className="size-4" aria-hidden />}
                  onClick={() => void copy(link)}
                >
                  Copy link
                </Button>
                <a href={shopPath(business.slug)} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
                  <ExternalLink className="size-4" aria-hidden /> See my page
                </a>
              </div>
            </>
          )}
        </div>
      </Modal>
    );
  }

  const contact = [
    "your business name",
    business.phone && "phone number",
    business.email && "email",
    business.address && "address",
    business.accountNumber && "bank account details",
  ].filter(Boolean) as string[];

  return (
    <Modal
      open
      onClose={onClose}
      title="Let people see your designs"
      size="lg"
      footer={
        status.ready && !nothingToDo ? (
          <>
            <Button variant="secondary" onClick={notNow} disabled={mutation.isPending} data-cy="show-designs-not-now">
              Not now
            </Button>
            <Button
              onClick={confirm}
              loading={mutation.isPending}
              disabled={ids.length === 0 && !publish}
              data-cy="show-designs-confirm"
            >
              {ids.length ? `Yes, show ${many(ids.length)}` : "Switch on my page"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {!status.ready ? (
        <Spinner />
      ) : nothingToDo ? (
        <p className="text-sm text-fg-muted">
          {status.pageOn
            ? "There is nothing to switch on."
            : "Your public page is switched off. Ask the business owner to switch it on."}
        </p>
      ) : (
        <div className="space-y-4">
          <FormError message={mutation.error ? errorMessage(mutation.error) : null} />
          {candidates.length > 0 && (
            <>
              <p className="text-sm text-fg">
                {candidates.length === 1
                  ? "Right now only your team can see this design. Do you want people to see it?"
                  : "Right now only your team can see these. Tap a picture to remove or add the tick."}
              </p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {candidates.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      aria-pressed={ticked(d.id)}
                      onClick={() => setChoice((c) => ({ ...c, [d.id]: !ticked(d.id) }))}
                      disabled={mutation.isPending}
                      className="block w-full text-left"
                      data-cy="show-designs-pick"
                    >
                      <span
                        className={cn(
                          "relative block aspect-[3/4] overflow-hidden rounded-lg border-2 bg-subtle",
                          ticked(d.id) ? "border-brand" : "border-transparent",
                        )}
                      >
                        <img
                          src={d.coverUrl ?? undefined}
                          alt=""
                          loading="lazy"
                          className={cn("size-full object-cover", !ticked(d.id) && "opacity-50")}
                        />
                        <span
                          className={cn(
                            "absolute top-1 right-1 flex size-6 items-center justify-center rounded-full border-2",
                            ticked(d.id) ? "border-brand bg-brand text-on-brand" : "border-white bg-black/30",
                          )}
                        >
                          {ticked(d.id) && <Check className="size-4" aria-hidden />}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-fg">{d.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {publish && (
            <p
              className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg"
              data-cy="show-designs-publish-note"
            >
              We'll also switch on your public page. Anyone with the link can see {contact.join(", ")} and the designs
              you show. You can switch it off any time in Settings.
            </p>
          )}
          {!status.pageOn && !status.canPublish && (
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg">
              Your public page is switched off. Ask the business owner to switch it on so everyone can see these.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
