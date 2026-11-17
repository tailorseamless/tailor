import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PaginationMeta } from "../../types/api.types";
import { cn } from "../../utils/cn";
import type { Tone } from "../../utils/statusLabels";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-fg-muted",
  brand: "bg-brand-soft text-link",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="font-semibold text-fg">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  tone?: "default" | "warning" | "danger";
}

export function StatCard({ label, value, hint, to, tone = "default" }: StatProps) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "warning" ? "text-warning-fg" : tone === "danger" ? "text-danger-fg" : "text-fg",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface p-4";
  return to ? (
    <Link
      to={to}
      className={cn(cls, "hover:border-line-strong")}
      data-cy={`stat-${label.toLowerCase().replace(/\W+/g, "-")}`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
          data-cy="back-link"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-fg">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-fg-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta: PaginationMeta | null; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-fg-muted">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!meta.hasPrev}
          onClick={() => onPage(meta.page - 1)}
          className="rounded-lg p-2 hover:bg-subtle disabled:opacity-40"
          aria-label="Previous page"
          data-cy="page-prev"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          disabled={!meta.hasNext}
          onClick={() => onPage(meta.page + 1)}
          className="rounded-lg p-2 hover:bg-subtle disabled:opacity-40"
          aria-label="Next page"
          data-cy="page-next"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          data-cy={`filter-${option.value}`}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm",
            value === option.value
              ? "border-brand bg-brand-soft text-link"
              : "border-line bg-surface text-fg-muted hover:bg-subtle",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled value in a detail panel. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children || "—"}</dd>
    </div>
  );
}
