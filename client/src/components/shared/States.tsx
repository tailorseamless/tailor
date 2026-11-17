import type { UseQueryResult } from "@tanstack/react-query";
import { CloudOff, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "../../utils/errors";
import { Button } from "./Button";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-fg-subtle">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <Spinner />
    </div>
  );
}

interface EmptyProps {
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, message, action, icon }: EmptyProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" data-cy="empty-state">
      <div className="mb-3 rounded-full bg-subtle p-3 text-fg-subtle">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </div>
      <p className="font-medium text-fg">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-fg-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center" data-cy="error-state">
      <div className="mb-3 rounded-full bg-danger-bg p-3 text-danger-fg">
        <CloudOff className="size-6" aria-hidden />
      </div>
      <p className="font-medium text-fg">Couldn't load this</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry} data-cy="retry">
          Try again
        </Button>
      )}
    </div>
  );
}

interface QueryStateProps<T> {
  query: UseQueryResult<T, Error>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}

/** Loading → error (with retry) → content. Every screen that reads data goes through this. */
export function QueryState<T>({ query, children, loadingLabel }: QueryStateProps<T>) {
  if (query.isPending) return <Spinner label={loadingLabel} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data)}</>;
}
