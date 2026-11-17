/** Converting between `datetime-local` inputs and ISO instants in a given zone (Frontend Guide §26). */

function parts(at: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => values.find((part) => part.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(at: Date, timeZone: string): number {
  const p = parts(at, timeZone);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - at.getTime();
}

/** ISO instant → "YYYY-MM-DDTHH:mm" as the wall clock in `timeZone`, for a datetime-local input. */
export function toLocalInput(iso: string | Date, timeZone: string): string {
  const p = parts(typeof iso === "string" ? new Date(iso) : iso, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** A datetime-local value, read as wall-clock time in `timeZone` → ISO instant. */
export function localInputToIso(value: string, timeZone: string): string {
  const asUtc = Date.parse(`${value}:00Z`);
  let instant = asUtc - offsetMs(new Date(asUtc), timeZone);
  instant = asUtc - offsetMs(new Date(instant), timeZone); // again, for days the zone changes offset
  return new Date(instant).toISOString();
}

/** Today as "YYYY-MM-DD" in `timeZone`. */
export function todayIn(timeZone: string): string {
  const p = parts(new Date(), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The browser's zone, the fallback when a person has none. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
