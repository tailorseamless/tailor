const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNITS: Record<string, number> = {
  s: SECOND,
  sec: SECOND,
  secs: SECOND,
  second: SECOND,
  seconds: SECOND,
  m: MINUTE,
  min: MINUTE,
  mins: MINUTE,
  minute: MINUTE,
  minutes: MINUTE,
  h: HOUR,
  hr: HOUR,
  hrs: HOUR,
  hour: HOUR,
  hours: HOUR,
  d: DAY,
  day: DAY,
  days: DAY,
};

/**
 * A length of time written with its unit, as milliseconds: "60d", "12h", "30m", "45s", "90 minutes", "1.5h".
 * `null` when it is not a number followed by a unit. A bare "60" is refused on purpose: seconds or days?
 */
export function parseDuration(text: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(text.trim());
  if (!match) return null;
  const unit = UNITS[match[2].toLowerCase()];
  if (unit === undefined) return null;
  const ms = Math.round(Number(match[1]) * unit);
  return Number.isFinite(ms) ? ms : null;
}

/** Milliseconds in words, in the largest unit that fits evenly: 5184000000 → "60 days", 90000 → "90 seconds". */
export function describeDuration(ms: number): string {
  const steps: [number, string][] = [
    [DAY, "day"],
    [HOUR, "hour"],
    [MINUTE, "minute"],
    [SECOND, "second"],
  ];
  for (const [size, name] of steps) {
    if (ms >= size && ms % size === 0) {
      const count = ms / size;
      return `${count} ${name}${count === 1 ? "" : "s"}`;
    }
  }
  return `${Math.round(ms / SECOND)} seconds`;
}

export const DURATION_LIMITS = { min: SECOND, max: 3650 * DAY } as const;
