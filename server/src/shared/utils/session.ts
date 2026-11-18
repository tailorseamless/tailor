/** The `errors[0].message` a client looks for to know it must sign in again (a fresh token would not help). */
export const SESSION_EXPIRED = "session_expired";

/** The `errors[0].message` for a token that is merely too old: the app fetches a new one and tries again. */
export const TOKEN_EXPIRED = "token_expired";

/** Whether a claim in seconds-since-1970 is more than `maxMs` ago. A missing or nonsense claim is not judged. */
function olderThan(seconds: unknown, maxMs: number, now: number): boolean {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return false;
  return now - seconds * 1000 > maxMs;
}

/**
 * Whether the person signed in longer ago than `maxMs` (SESSION_LIFETIME). `authTime` is the ID token's `auth_time`
 * claim, which Firebase keeps unchanged when it renews the token. Only signing in again resets it.
 */
export function sessionHasEnded(authTime: unknown, maxMs: number, now = Date.now()): boolean {
  return olderThan(authTime, maxMs, now);
}

/**
 * Whether the token itself was issued longer ago than `maxMs` (ACCESS_TOKEN_LIFETIME). `iat` is when Firebase issued
 * this particular token; renewing the token gives a new one, so unlike `authTime` this is reset by a refresh.
 */
export function tokenHasAged(iat: unknown, maxMs: number, now = Date.now()): boolean {
  return olderThan(iat, maxMs, now);
}
