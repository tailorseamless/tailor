import { PUSH } from "../../../config/constants";

/** Push delivery rules — pure, no I/O (Backend Guide §26.1). */

/** Only an in-app absolute path: "//evil.example" and "https://…" become the inbox. */
export function pushLink(linkPath: string | null): string {
  return linkPath && /^\/(?![/\\])/.test(linkPath) ? linkPath : "/notifications";
}

export function pushBody(body: string | null): string {
  const text = (body ?? "").trim();
  return text.length > PUSH.bodyMax ? `${text.slice(0, PUSH.bodyMax - 1)}…` : text;
}

/** Errors that mean the browser is gone for good — its token is deleted. Anything else is retried. */
const DEAD_TOKEN = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);
export const isDeadToken = (code: string | undefined): boolean => Boolean(code && DEAD_TOKEN.has(code));

export function isStale(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > PUSH.maxAgeHours * 3_600_000;
}

/** After the nth failed attempt: retry in 2ⁿ minutes, or give up (null). */
export function nextPushRetry(attemptsSoFar: number, now: Date): Date | null {
  const attempts = attemptsSoFar + 1;
  return attempts >= PUSH.maxAttempts ? null : new Date(now.getTime() + 2 ** attempts * 60_000);
}
