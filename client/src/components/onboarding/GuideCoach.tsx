import { CheckCircle2, ChevronDown, Compass, PartyPopper, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { useToast } from "../../contexts/ToastContext";
import { useWorkspace } from "../../hooks/useWorkspace";
import { cn } from "../../utils/cn";
import { Button, ButtonLink, IconButton } from "../shared/Button";
import { isOnStep } from "./guideSteps";

/** Above the phone tab bar; bottom-right on wider screens. Under modals (z-50), so it never covers a form. */
const placement = "fixed right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6";

/** The floating getting-started guide: one step at a time, with hints for the page they're on. */
export function GuideCoach() {
  const guide = useOnboarding();
  const { me } = useWorkspace();
  const { pathname } = useLocation();
  const toast = useToast();
  if (!guide.active) return null;

  const { steps, completed, current, justCompleted } = guide;
  const doneCount = steps.filter((s) => completed.has(s.id)).length;
  const position = current ? steps.indexOf(current) + 1 : steps.length;

  if (guide.collapsed) {
    return (
      <button
        type="button"
        onClick={() => guide.setCollapsed(false)}
        aria-expanded={false}
        className={cn(
          placement,
          "flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-pop hover:bg-brand-hover",
        )}
        data-cy="guide-expand"
      >
        <Compass className="size-4" aria-hidden />
        Setup guide · {doneCount} of {steps.length}
      </button>
    );
  }

  const close = () => {
    guide.dismiss();
    toast.info("Guide closed. You can open it again from Settings.");
  };

  const onPage = current ? isOnStep(current, pathname) : false;
  const firstName = me.user.fullName.split(/\s+/)[0];
  const Icon = current?.icon ?? PartyPopper;

  return (
    <aside
      aria-label="Getting started guide"
      className={cn(
        placement,
        "left-3 flex max-h-[45dvh] md:max-h-[min(32rem,70dvh)] flex-col rounded-xl border border-line bg-surface shadow-modal md:left-auto md:w-96",
      )}
      data-cy="guide"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Compass className="size-4 text-link" aria-hidden />
        <p className="flex-1 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          {current ? `Getting started · Step ${position} of ${steps.length}` : "Getting started"}
        </p>
        <IconButton
          label="Minimise guide"
          className="size-8"
          onClick={() => guide.setCollapsed(true)}
          data-cy="guide-collapse"
        >
          <ChevronDown className="size-4" aria-hidden />
        </IconButton>
        <IconButton label="Close guide" className="size-8" onClick={close} data-cy="guide-close">
          <X className="size-4" aria-hidden />
        </IconButton>
      </header>

      <ol className="flex gap-1 px-4 pt-3" aria-label={`${doneCount} of ${steps.length} steps done`}>
        {steps.map((s) => (
          <li
            key={s.id}
            title={s.title}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              completed.has(s.id) ? "bg-brand" : s.id === current?.id ? "bg-brand/40" : "bg-subtle",
            )}
          />
        ))}
      </ol>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {justCompleted && justCompleted.id !== current?.id && (
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-success-fg" role="status">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {justCompleted.doneMessage} {current ? "Next up:" : ""}
          </p>
        )}
        {current && doneCount === 0 && !justCompleted && position === 1 && (
          <p className="mb-3 text-sm text-fg">
            Welcome, {firstName}! {steps.length} quick steps and your shop is ready to go.
          </p>
        )}

        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-link">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-fg" data-cy="guide-title">
              {current ? current.title : "You're all set!"}
            </h2>
            {!current && (
              <p className="mt-1 text-sm text-fg-muted">
                Your shop is set up. You can open this guide again any time from Settings.
              </p>
            )}
            {current && !onPage && <p className="mt-1 text-sm text-fg-muted">{current.summary}</p>}
          </div>
        </div>

        {current && onPage && (
          <ol className="mt-3 space-y-2" data-cy="guide-tips">
            {current.tips.map((tip, i) => (
              <li key={tip} className="flex gap-2.5 text-sm text-fg">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-fg-muted tabular-nums">
                  {i + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        )}
        {current && onPage && !current.confirmLabel && !completed.has(current.id) && (
          <p className="mt-3 text-xs text-fg-subtle">This step ticks itself off once you save.</p>
        )}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
        {!current ? (
          <Button size="sm" onClick={guide.dismiss} data-cy="guide-finish">
            Finish
          </Button>
        ) : completed.has(current.id) ? (
          <>
            {!onPage && (
              <ButtonLink size="sm" variant="secondary" to={current.start ?? current.path}>
                {current.startLabel}
              </ButtonLink>
            )}
            <Button size="sm" onClick={() => guide.complete(current.id)} data-cy="guide-next">
              Next step
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => guide.complete(current.id)} data-cy="guide-skip">
              Skip
            </Button>
            {!onPage ? (
              <ButtonLink size="sm" to={current.start ?? current.path} data-cy="guide-go">
                {current.startLabel}
              </ButtonLink>
            ) : (
              current.confirmLabel && (
                <Button size="sm" onClick={() => guide.complete(current.id)} data-cy="guide-confirm">
                  {current.confirmLabel}
                </Button>
              )
            )}
          </>
        )}
      </footer>
    </aside>
  );
}
