import { SECURITY } from "../../../config/constants";
import { logger } from "../../../infrastructure/logger/logger";
import { currentRequestContext } from "../../../shared/context/requestContext";
import { SecurityCounterRepository } from "../repositories/securityCounter.repository";

/** What is counted. Each is a request the API turned away for a security reason. */
export type SecurityEventKind =
  | "auth_failed" // a sign-in token that didn't verify
  | "disabled_access" // a valid sign-in for an account that is disabled, unlinked, or whose business is suspended
  | "forbidden" // a signed-in person asking for something their role doesn't allow
  | "rate_limited" // too many requests from one address
  | "portal_token_invalid"; // a customer-portal link that doesn't exist

/** Counts are written to the database at these totals within a window, then every `SECURITY.writeEvery`. */
const MILESTONES = new Set([1, 5, 10, 20, 50]);

/**
 * Counts security-relevant refusals per kind and address in 10-minute windows. Counting happens in
 * memory; the database is written only at milestones (1, 5, 10, 20, 50, then every 100), so a flood
 * of bad requests costs a handful of writes, never one per request. Never throws, never waits.
 */
export class SecurityMonitor {
  static Instance = new SecurityMonitor();

  private window = 0;
  private counts = new Map<string, number>();

  private constructor(private readonly counters = SecurityCounterRepository.Instance) {}

  note(kind: SecurityEventKind, userId: string | null = null, now = Date.now()): void {
    const ip = currentRequestContext()?.ip ?? "unknown";
    const window = Math.floor(now / SECURITY.windowMs) * SECURITY.windowMs;
    if (window !== this.window) {
      this.window = window;
      this.counts.clear();
    }
    const key = `${kind}|${ip}`;
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    if (!MILESTONES.has(count) && count % SECURITY.writeEvery !== 0) return;
    this.counters
      .record({ windowStart: new Date(window), kind, ip, count, userId })
      .catch((err: unknown) => logger.warn({ err, kind }, "security counter not recorded"));
  }
}
