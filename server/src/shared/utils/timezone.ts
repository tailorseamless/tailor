/**
 * Local-time logic uses the person's or business's IANA zone — never the
 * server's (Backend Guide §27.4).
 */

/** The calendar day `days` after (or, if negative, before) a `YYYY-MM-DD` day. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Today" as `YYYY-MM-DD` in the given zone; an unknown zone falls back to UTC. */
export function localDay(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      now,
    );
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** How far ahead of UTC the zone is at that instant, in ms (negative when behind). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at.getTime();
}

/** The instant a `YYYY-MM-DD` day begins in the zone (midnight there). Unknown zone → UTC midnight. */
export function zonedMidnight(day: string, timeZone: string): Date {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  try {
    // Twice, so a day on which the zone changes its offset still lands right.
    let instant = utcMidnight - zoneOffsetMs(new Date(utcMidnight), timeZone);
    instant = utcMidnight - zoneOffsetMs(new Date(instant), timeZone);
    return new Date(instant);
  } catch {
    return new Date(utcMidnight);
  }
}
