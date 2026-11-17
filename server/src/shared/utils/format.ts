/** Display formatting for emails, PDFs and exports — pure, no I/O. */

/** `NGN 40,000.20`. The code, not a symbol: the PDF's built-in fonts have no ₦. */
export function formatMoney(amount: number, currency: string): string {
  const number = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${currency} ${number}`;
}

function inZone(at: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(at);
  }
}

/** `16 Nov 2026, 14:05` in the given zone. */
export const formatDateTime = (at: Date, timeZone: string): string =>
  inZone(at, timeZone, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** `Tue 10 Mar, 10:00` in the given zone. */
export const formatShortDateTime = (at: Date, timeZone: string): string =>
  inZone(at, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/** `16 Nov 2026` for a `YYYY-MM-DD` day. */
export function formatDay(day: string): string {
  return inZone(new Date(`${day}T12:00:00Z`), "UTC", { day: "numeric", month: "short", year: "numeric" });
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  pos: "POS",
  other: "Other",
};

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  measurement: "Measurement",
  consultation: "Design consultation",
  fitting: "Fitting",
  alteration: "Alteration",
  collection: "Collection",
};

/** `2026-11-16 14:05` — wall-clock time in the zone, for spreadsheets (which have no zones). */
export function localDateTime(at: Date, timeZone: string): string {
  const format = (zone: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(at);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  };
  try {
    return format(timeZone);
  } catch {
    return format("UTC");
  }
}
