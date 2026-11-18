import { VULGAR } from "./measureInput";

/** Fractions a tailor reads off a tape, in the order they sit on it. */
export const FRACTION_KEYS = ["⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"] as const;

const FRACTION_CHARS = Object.keys(VULGAR).join("");
const OPERATORS = "+−×÷";
const round = (n: number) => Math.round(n * 100) / 100;

type Token = number | "+" | "-" | "*" | "/" | "(" | ")";

/** `24½` is one number (24.5), so a fraction is read together with the digits before it. */
function tokenise(text: string): Token[] | null {
  const tokens: Token[] = [];
  const number = new RegExp(`^(\\d+(?:[.,]\\d+)?)?\\s*([${FRACTION_CHARS}])?`);
  let rest = text.trim();
  while (rest) {
    const char = rest[0];
    if (char === " ") {
      rest = rest.slice(1);
    } else if ("+-−–".includes(char)) {
      tokens.push(char === "+" ? "+" : "-");
      rest = rest.slice(1);
    } else if ("*×xX".includes(char)) {
      tokens.push("*");
      rest = rest.slice(1);
    } else if ("/÷".includes(char)) {
      tokens.push("/");
      rest = rest.slice(1);
    } else if (char === "(" || char === ")") {
      tokens.push(char);
      rest = rest.slice(1);
    } else {
      const found = number.exec(rest);
      if (!found || !found[0].trim()) return null;
      tokens.push(Number((found[1] ?? "0").replace(",", ".")) + (found[2] ? VULGAR[found[2]] : 0));
      rest = rest.slice(found[0].length);
    }
  }
  return tokens;
}

/**
 * The answer to what was typed in the calculator: `20*2`, `17 + ½`, `(36 + 4) ÷ 2`. Anything that isn't a sum, or
 * that divides by zero, is `null`. Parsed by hand, never evaluated as code. Rounded to two decimals, like a saved
 * measurement.
 */
export function calculate(text: string): number | null {
  const read = tokenise(text);
  if (!read?.length) return null;
  const tokens: Token[] = read;
  let at = 0;

  const unary = (): number | null => {
    const next = tokens[at];
    if (next === "-" || next === "+") {
      at += 1;
      const value = unary();
      return value === null ? null : next === "-" ? -value : value;
    }
    if (next === "(") {
      at += 1;
      const value = sum();
      if (value === null || tokens[at] !== ")") return null;
      at += 1;
      return value;
    }
    if (typeof next === "number") {
      at += 1;
      return next;
    }
    return null;
  };

  const product = (): number | null => {
    let value = unary();
    while (value !== null && (tokens[at] === "*" || tokens[at] === "/")) {
      const op = tokens[at++];
      const right = unary();
      if (right === null || (op === "/" && right === 0)) return null;
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };

  function sum(): number | null {
    let value = product();
    while (value !== null && (tokens[at] === "+" || tokens[at] === "-")) {
      const op = tokens[at++];
      const right = product();
      if (right === null) return null;
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  const answer = sum();
  if (answer === null || at !== tokens.length || !Number.isFinite(answer) || Math.abs(answer) > 1e9) return null;
  return round(answer) + 0; // + 0 turns -0 into 0
}

/** The text of an answer, as it is typed into a measurement box: `27.5`, not `27.50`. */
export const answerText = (n: number) => String(round(n));

const lastChar = (text: string) => text.slice(-1);
const endsInNumber = (text: string) => /[\d.]$/.test(text);
const lastNumberHasDot = (text: string) => /\d*\.\d*$/.test(text);
// `"abc".includes("")` is true, so an empty expression has to be ruled out before asking what it ends in.
const endsIn = (set: string, text: string) => text !== "" && set.includes(lastChar(text));

/** What the keypad does to the expression when `key` is tapped. Keys that make no sense there change nothing. */
export function pressKey(expression: string, key: string): string {
  if (key === "C") return "";
  if (key === "⌫") return expression.slice(0, -1);
  if (key === "=") {
    const answer = calculate(expression);
    return answer === null ? expression : answerText(answer);
  }
  if (expression.length >= 60) return expression;

  const afterFraction = endsIn(FRACTION_CHARS, expression);
  // A fraction closes a number: 24½ is complete, so 24½5 and 24½. make no sense.
  if (/^\d$/.test(key)) return afterFraction ? expression : expression + key;
  if (key === ".") {
    if (afterFraction || (endsInNumber(expression) && lastNumberHasDot(expression))) return expression;
    return expression + (endsInNumber(expression) ? "." : "0.");
  }
  if (FRACTION_CHARS.includes(key)) {
    // After a digit (24½), at the start, or after a sign: not after another fraction or a lone dot.
    return afterFraction || lastChar(expression) === "." ? expression : expression + key;
  }
  if (OPERATORS.includes(key)) {
    if (!expression) return key === "−" ? key : expression; // only a minus can start a sum
    if (endsIn(OPERATORS, expression)) return expression.slice(0, -1) + key;
    if (lastChar(expression) === ".") return expression;
    return expression + key;
  }
  return expression;
}
