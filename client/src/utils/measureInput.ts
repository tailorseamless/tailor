const VULGAR: Record<string, number> = {
  "½": 1 / 2,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * What a tailor types in a measurement box, as a number: `24`, `24.5`, `24,5`, `24½`, `24 1/2` or `24-1/2`.
 * Anything else is `null` — in particular a bare `40/39` or `1/2`, which could mean two numbers rather than one
 * fraction, so it is never guessed at.
 */
export function parseMeasure(text: string): number | null {
  const s = text.trim();
  if (!s) return null;

  if (/^\d+([.,]\d+)?$/.test(s)) return round(Number(s.replace(",", ".")));

  const vulgar = /^(\d*)\s*([½¼¾⅛⅜⅝⅞⅓⅔])$/.exec(s);
  if (vulgar) return round(Number(vulgar[1] || 0) + VULGAR[vulgar[2]]);

  // A whole number first, so "8/16" is not quietly read as a half.
  const mixed = /^(\d+)(?:\s+|\s*-\s*)(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed && Number(mixed[3]) > Number(mixed[2])) return round(Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]));

  return null;
}
