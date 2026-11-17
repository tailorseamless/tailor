import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { cn } from "../../utils/cn";
import { formatDay } from "../../utils/formatDate";
import { browserTimeZone, todayIn } from "../../utils/timezone";
import { Button } from "./Button";

/*
 * A calendar that lives inside the page, instead of the browser's own date popup.
 * Browsers draw that popup outside the page, and several close it the moment anything
 * re-renders or focus moves (embedded browsers and some dialogs do it every time).
 * Days are plain "YYYY-MM-DD" strings throughout: no Date objects in a local zone, so no off-by-one days.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const toParts = (day: string) => day.split("-").map(Number) as [number, number, number];
const utc = (day: string) => {
  const [y, m, d] = toParts(day);
  return new Date(Date.UTC(y, m - 1, d));
};
const toDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const date = utc(day);
  date.setUTCDate(date.getUTCDate() + n);
  return toDay(date);
};
const addMonths = (day: string, n: number) => {
  const [y, m, d] = toParts(day);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return toDay(target);
};
const monthOf = (day: string) => day.slice(0, 7);
/** The Monday on or before `day`. */
const weekStart = (day: string) => addDays(day, -((utc(day).getUTCDay() + 6) % 7));

const monthTitle = (day: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(day));
const longDay = (day: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc(day));

/** The 6 weeks (42 days) shown for the month containing `day`, starting on a Monday. */
function monthGrid(day: string): string[] {
  const first = `${monthOf(day)}-01`;
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

interface Props {
  /** "YYYY-MM-DD", or "" when no date is chosen. */
  value: string;
  onChange: (day: string) => void;
  onBlur?: () => void;
  /** Earliest and latest day that can be chosen ("YYYY-MM-DD"). */
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Show "Clear" so the date can be left empty again. Off for fields that always need a date. */
  clearable?: boolean;
  /** Decides what "today" is. Defaults to the browser's zone. */
  timeZone?: string;
  /** Spread from <Field>: the label's id and the error wiring. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** For fields that have no visible <Field> label (a day picker in a toolbar). */
  "aria-label"?: string;
  "data-cy"?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  onBlur,
  min,
  max,
  disabled,
  placeholder = "Choose a date",
  clearable = true,
  timeZone,
  className,
  "data-cy": dataCy,
  ...aria
}: Props) {
  const today = todayIn(timeZone ?? browserTimeZone());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(today); // any day in the month being shown
  const [focused, setFocused] = useState(today); // the one day that is in the tab order
  const content = useRef<HTMLDivElement>(null);

  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);
  const clamp = (day: string) => (min && day < min ? min : max && day > max ? max : day);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      const start = value || clamp(today);
      setView(start);
      setFocused(start);
    } else {
      onBlur?.();
    }
  };

  /** Paging months moves the tab stop with it, so there is always a day the keyboard can land on. */
  const showMonth = (day: string) => {
    setView(day);
    setFocused(clamp(day));
  };

  const focusDay = (day: string) => {
    const next = clamp(day);
    // Render the grid around the new day first, then move focus onto it, in the same keypress.
    flushSync(() => {
      setFocused(next);
      if (monthOf(next) !== monthOf(view)) setView(next);
    });
    content.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus();
  };

  const onGridKey = (event: KeyboardEvent) => {
    // Only presses on a day move around the grid; the month buttons keep their own keys.
    if (!(event.target as HTMLElement).closest("[data-day]")) return;
    const moves: Record<string, string> = {
      ArrowLeft: addDays(focused, -1),
      ArrowRight: addDays(focused, 1),
      ArrowUp: addDays(focused, -7),
      ArrowDown: addDays(focused, 7),
      PageUp: addMonths(focused, -1),
      PageDown: addMonths(focused, 1),
      Home: weekStart(focused),
      End: addDays(weekStart(focused), 6),
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    focusDay(next);
  };

  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
    onBlur?.();
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "control flex items-center justify-between gap-2 text-left",
            !value && "text-fg-subtle",
            className,
          )}
          data-cy={dataCy}
          {...aria}
        >
          <span className="truncate">{value ? formatDay(value) : placeholder}</span>
          <CalendarDays className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          align="start"
          sideOffset={6}
          collisionPadding={8}
          // Above dialogs (z-50) and toasts (z-60), so it works inside a modal too.
          className="z-[70] w-72 rounded-xl border border-line bg-surface p-3 shadow-pop"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.querySelector<HTMLButtonElement>('[tabindex="0"][data-day]')?.focus();
          }}
          aria-label="Choose a date"
          onKeyDown={onGridKey}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => showMonth(addMonths(view, -1))}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-subtle hover:text-fg"
              aria-label="Previous month"
              data-cy="datepicker-prev"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-semibold text-fg" aria-live="polite" data-cy="datepicker-title">
              {monthTitle(view)}
            </p>
            <button
              type="button"
              onClick={() => showMonth(addMonths(view, 1))}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-subtle hover:text-fg"
              aria-label="Next month"
              data-cy="datepicker-next"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div role="grid" aria-label={monthTitle(view)}>
            <div role="row" className="mb-1 grid grid-cols-7 text-center text-xs text-fg-subtle">
              {WEEKDAYS.map((w) => (
                <span key={w} role="columnheader" className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {monthGrid(view).map((day) => {
                const inMonth = monthOf(day) === monthOf(view);
                const selected = day === value;
                const ok = allowed(day);
                return (
                  <div key={day} role="gridcell" className="flex justify-center">
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === focused ? 0 : -1}
                      disabled={!ok}
                      onClick={() => pick(day)}
                      aria-label={longDay(day)}
                      aria-pressed={selected}
                      aria-current={day === today ? "date" : undefined}
                      className={cn(
                        "size-9 rounded-lg text-sm tabular-nums",
                        selected
                          ? "bg-brand font-semibold text-on-brand"
                          : cn(inMonth ? "text-fg" : "text-fg-subtle", ok && "hover:bg-subtle"),
                        day === today && !selected && "ring-1 ring-brand",
                        !ok && "cursor-not-allowed opacity-35",
                      )}
                      data-cy="datepicker-day"
                    >
                      {Number(day.slice(8))}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!allowed(today)}
              onClick={() => pick(today)}
              data-cy="datepicker-today"
            >
              Today
            </Button>
            {clearable && value && (
              <Button size="sm" variant="ghost" onClick={() => pick("")} data-cy="datepicker-clear">
                Clear
              </Button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
