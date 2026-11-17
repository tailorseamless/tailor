import { z } from "zod";

/** Shared Zod helpers — reuse them, don't rewrite them (Backend Guide §4.2). */

export const uuid = z.string().uuid();

/** uuid-validated path params: `params: idParams("id")`. */
export function idParams<const K extends string>(...names: K[]) {
  const shape = Object.fromEntries(names.map((name) => [name, uuid])) as { [P in K]: typeof uuid };
  return z.object(shape);
}

/** A required, trimmed string between `min` and `max` characters. */
export const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Optional free text; a blank string is stored as NULL. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/** `YYYY-MM-DD` */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

/** `YYYY-MM-DD` that is a real day on the calendar (rejects 2026-02-31). */
export const calendarDate = isoDate.refine((day) => {
  const time = Date.parse(`${day}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(day);
}, "Enter a real date");

export const isoDateTime = z.string().datetime({ offset: true });

/** An IANA time zone the runtime actually knows. */
export const timeZone = z
  .string()
  .trim()
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone");

/** `?flag=true|false` */
export const queryBool = z.enum(["true", "false"]).transform((value) => value === "true");

/** Lower-cased so the unique index on the stored column is usable (Backend Guide §10.3). */
export const email = z.string().trim().toLowerCase().email().max(150);

/**
 * A phone number, stored without spaces or punctuation so the same number
 * always compares equal: "0803 123-4567" → "08031234567", "+234 803…" → "+234803…".
 */
export const phone = z
  .string()
  .trim()
  .max(30)
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .refine((value) => /^\+?\d{7,15}$/.test(value), "Enter a valid phone number");
