import type { LucideIcon } from "lucide-react";
import { useNotNow } from "../../hooks/useNotNow";
import { Button } from "../shared/Button";

/** One thing the app has noticed and can help with. */
export interface Notice {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: { label: string; run: () => void; busy?: boolean };
  /** What "Not now" remembers. */
  later: string[];
}

export function HelpNotice({ notice }: { notice: Notice }) {
  const { keep } = useNotNow();
  const { icon: Icon, title, message, action, later } = notice;
  return (
    <section
      aria-label="Help from the app"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-brand-soft p-4 sm:flex-row sm:items-center"
      data-cy="help-notice"
    >
      <Icon className="hidden size-6 shrink-0 text-link sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-fg">{title}</h2>
        <p className="text-sm text-fg-muted">{message}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {action && (
          <Button onClick={action.run} loading={action.busy} data-cy="help-fix">
            {action.label}
          </Button>
        )}
        <Button variant="ghost" onClick={() => keep(later)} data-cy="help-later">
          Not now
        </Button>
      </div>
    </section>
  );
}
