import dns from "node:dns";
import net from "node:net";
import { logger } from "../logger/logger";

/**
 * A database connection that survives a flaky DNS lookup.
 *
 * Every new Postgres connection looks the host up first. On a flaky network that lookup sometimes fails,
 * or hangs for seconds (`getaddrinfo ENOTFOUND` for a name that resolved a moment ago), and the request that
 * needed the connection stalled and then became a 500.
 *
 * Once an address has worked it is remembered. A lookup that fails, or that is still unanswered after
 * SLOW_MS, is answered with that address straight away, and the real lookup carries on in the background
 * to refresh it. With no address on record yet, a failed lookup is retried. A hosted database keeps its
 * address for long stretches, and TLS still checks the certificate against the host name (the driver sets
 * the server name itself), so only *where* we connect changes, never *who* we trust.
 */
const TRANSIENT = new Set(["ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ESERVFAIL", "ECONNREFUSED"]);
const ATTEMPTS = 3;
const BACKOFF_MS = 400;
/** How long a lookup may take before a remembered address is used instead. */
const SLOW_MS = 1500;

/** The last good answer per host, kept exactly as dns.lookup gave it so it can be replayed. */
const lastGood = new Map<string, unknown[]>();

type LookupCallback = (err: NodeJS.ErrnoException | null, ...rest: unknown[]) => void;

export function resilientLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  // `all` changes the shape of the answer, so keep the two kinds apart.
  const key = `${hostname}|${options.all ? "all" : "one"}`;
  let answered = false;
  let slowTimer: NodeJS.Timeout | undefined;

  /** Answers the caller once; later answers (from a lookup we stopped waiting for) only refresh the memory. */
  const answer: LookupCallback = (err, ...rest) => {
    if (answered) return;
    answered = true;
    clearTimeout(slowTimer);
    callback(err, ...rest);
  };

  const useKnown = (reason: string): boolean => {
    const known = lastGood.get(key);
    if (!known) return false;
    logger.warn({ host: hostname, reason }, "database host lookup is failing or slow, using the last known address");
    answer(null, ...known);
    return true;
  };

  if (lastGood.has(key)) slowTimer = setTimeout(() => useKnown("slow"), SLOW_MS);

  const attempt = (n: number): void => {
    // Read dns.lookup afresh each time: callers (and tests) may swap it.
    (dns.lookup as (host: string, opts: dns.LookupOptions, cb: LookupCallback) => void)(
      hostname,
      options,
      (err, ...found) => {
        if (!err) {
          lastGood.set(key, found);
          return answer(null, ...found);
        }
        if (answered) return;
        if (!err.code || !TRANSIENT.has(err.code)) return answer(err);
        if (useKnown(err.code)) return;
        if (n < ATTEMPTS) {
          logger.warn({ host: hostname, code: err.code, attempt: n }, "database host lookup failed, retrying");
          setTimeout(() => attempt(n + 1), BACKOFF_MS * n);
          return;
        }
        answer(err);
      },
    );
  };
  attempt(1);
}

/** A socket whose host lookups go through resilientLookup. Handed to the driver as its `stream` factory. */
class ResilientSocket extends net.Socket {
  override connect(options: net.SocketConnectOpts, connectionListener?: () => void): this;
  override connect(port: number, host: string, connectionListener?: () => void): this;
  override connect(port: number, connectionListener?: () => void): this;
  override connect(path: string, connectionListener?: () => void): this;
  override connect(first: unknown, second?: unknown, third?: unknown): this {
    // The driver calls connect(port, host). Anything else (a unix socket, an options object) is left alone.
    if (typeof first === "number" && typeof second === "string" && net.isIP(second) === 0) {
      return super.connect(
        { port: first, host: second, lookup: resilientLookup as net.LookupFunction },
        third as (() => void) | undefined,
      );
    }
    return (super.connect as (...args: unknown[]) => this)(first, second, third);
  }
}

export const resilientStream = (): net.Socket => new ResilientSocket();
