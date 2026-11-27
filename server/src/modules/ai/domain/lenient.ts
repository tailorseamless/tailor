import { z, type ZodError, type ZodTypeAny } from "zod";

/**
 * Model replies are untrusted. Hosted providers enforce the JSON schema; open models get the content right
 * and the form slightly wrong. These helpers keep a usable draft while a genuinely missing field still fails.
 */

/** null/undefined → ""; array → lines; object → JSON; anything else → String(v). */
export const looseText = z.preprocess((value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value))
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}, z.string());

/** null/undefined → []. */
export const looseList = <T extends ZodTypeAny>(item: T) =>
  z.preprocess((value) => (value === null || value === undefined ? [] : value), z.array(item));

const FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

/**
 * A number written as text, as tailors write them: "34.5", "34,5 in", "14½", "32 3/4", "½". Null when there is none.
 */
export function numberFromText(text: string): number | null {
  const value = text.trim();
  // "14½", "½"
  const unicode = /(\d+)?\s*([¼½¾⅛⅜⅝⅞])/.exec(value);
  if (unicode) return (unicode[1] ? Number(unicode[1]) : 0) + FRACTIONS[unicode[2]];
  // "32 3/4", "3/4". Only a proper fraction counts, so "12/03" is never read as one.
  const slash = /(?:^|[^\d/])(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)(?![\d/])/.exec(` ${value}`);
  if (slash) {
    const numerator = Number(slash[2]);
    const denominator = Number(slash[3]);
    if (denominator > 0 && numerator < denominator) return (slash[1] ? Number(slash[1]) : 0) + numerator / denominator;
  }
  const plain = /-?\d+(?:[.,]\d+)?/.exec(value);
  return plain ? Number(plain[0].replace(",", ".")) : null;
}

/** A number, or a number written as text (see numberFromText); anything else → `fallback`. */
export const looseNumber = (fallback: number) =>
  z.preprocess((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") return numberFromText(value) ?? fallback;
    return fallback;
  }, z.number());

const squash = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

/** Case- and space-insensitive enum; anything unknown → `fallback`. */
export const looseChoice = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return fallback;
      const found = values.find((choice) => squash(choice) === squash(value));
      return found ?? fallback;
    },
    z.enum(values as unknown as [T[number], ...T[number][]]),
  );

/** As looseChoice, also accepting aliases ("approved" → "accepted"), but an unknown value stays an error. */
export const strictChoice = <const T extends readonly [string, ...string[]]>(
  values: T,
  aliases: Record<string, T[number]> = {},
) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const key = squash(value);
      return values.find((choice) => squash(choice) === key) ?? aliases[key] ?? value;
    },
    z.enum(values as unknown as [T[number], ...T[number][]]),
  );

/** Why a reply could not be used, in words the model can act on when it is asked again. */
export function describeRejection(json: unknown, error: ZodError | null): string {
  if (json === undefined || typeof json !== "object" || json === null || Array.isArray(json)) {
    return "it was not a JSON object";
  }
  if (!error) return "it did not match the schema";
  return error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/**
 * Real-world replies: reasoning models wrap thoughts in <think>…</think>, others add prose or a code fence.
 * Strip the thoughts, try the whole text, else the outermost { … }, else undefined.
 */
export function parseJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

/** Cuts text to `max` characters at a word boundary when there is one close by. */
export function fit(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd();
}

/**
 * Makes text that someone else wrote unable to close or open the prompt's own tags: `</notes>` becomes `‹/notes>`.
 * Build one per prompt with that prompt's tag names, and run every piece of stranger-written text through it.
 */
export function inertFor(tags: readonly string[]): (text: string) => string {
  const pattern = new RegExp(`<\\/?(${tags.join("|")})\\b`, "gi");
  return (text) => text.replace(pattern, (match) => `‹${match.slice(1)}`);
}
