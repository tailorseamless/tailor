import { Coins } from "lucide-react";
import { Link } from "react-router-dom";
import { useAiStatus } from "../../hooks/useAi";
import { useWorkspace } from "../../hooks/useWorkspace";
import { cn } from "../../utils/cn";

/** "98.4K": short enough for a phone's header. */
const short = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/**
 * The business's AI tokens, always in view. Shown once AI is switched on. People who can add customers can tap
 * it to snap or upload a record; with none left, that page says how to get more.
 */
export function TokenBadge() {
  const { can } = useWorkspace();
  const status = useAiStatus("record_capture", can("ai.use"));
  if (!can("ai.use") || !status.data?.configured) return null;

  const left = status.data.tokensLeft;
  const label = `${left.toLocaleString()} AI tokens left`;
  const className = cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap",
    left === 0 ? "bg-danger-bg text-danger-fg" : "bg-subtle text-fg",
  );
  const content = (
    <>
      <Coins className="size-4" aria-hidden />
      <span className="sm:hidden" aria-hidden>
        {short.format(left)}
      </span>
      <span className="hidden sm:inline" aria-hidden>
        {left.toLocaleString()} tokens
      </span>
      <span className="sr-only">{label}</span>
    </>
  );

  return can("customer.create") ? (
    <Link to="/capture" className={cn(className, "hover:opacity-80")} title={label} data-cy="header-tokens">
      {content}
    </Link>
  ) : (
    <span className={className} title={label} data-cy="header-tokens">
      {content}
    </span>
  );
}
