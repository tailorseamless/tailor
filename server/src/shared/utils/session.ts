/** The `errors[0].message` a client looks for to know it must sign in again (a fresh token would not help). */
export const SESSION_EXPIRED = "session_expired";

/**
 * Whether the person signed in longer ago than `maxMs` (SESSION_LIFETIME). `authTime` is the ID token's `auth_time`
 * claim: seconds since the person last actually signed in, which Firebase keeps unchanged when it renews the token.
 * A token without the claim, or with a nonsense one, is not judged here: Firebase rejects those.
 */
export function sessionHasEnded(authTime: unknown, maxMs: number, now = Date.now()): boolean {
  if (typeof authTime !== "number" || !Number.isFinite(authTime)) return false;
  return now - authTime * 1000 > maxMs;
}
