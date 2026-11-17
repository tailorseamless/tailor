/** Dates and times, always in the person's time zone (Frontend Guide §26). Never raw Date#toLocale*. */

function format(iso: string | Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  const at = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(at);
  }
}

/** "16 Nov 2026" */
export const formatDate = (iso: string | Date, timeZone: string) =>
  format(iso, timeZone, { day: "numeric", month: "short", year: "numeric" });

/** "14:05" */
export const formatTime = (iso: string | Date, timeZone: string) =>
  format(iso, timeZone, { hour: "2-digit", minute: "2-digit", hour12: false });

/** "Mon 16 Nov, 14:05" */
export const formatDateTime = (iso: string | Date, timeZone: string) =>
  format(iso, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** A calendar day `YYYY-MM-DD` (no zone involved): "16 Nov 2026". */
export function formatDay(day: string): string {
  return format(new Date(`${day}T12:00:00Z`), "UTC", { day: "numeric", month: "short", year: "numeric" });
}

/** "3 days ago", "in 2 hours" */
export function relative(iso: string, now = Date.now()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) return rtf.format(Math.round(diffSeconds / seconds), unit);
  }
  return "just now";
}
