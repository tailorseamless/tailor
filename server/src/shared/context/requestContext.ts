import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Where the code that is running was started from: an HTTP request (with its id, address and device),
 * or nothing (a job, a script). Set once per request by the requestId middleware and read by the audit
 * trail, so the ~40 places that write an audit row never pass it along by hand.
 */
export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  /** The path without its query string, e.g. "/api/v1/portal/abc". */
  path: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` (and everything it awaits) with this context. */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The current request, or undefined outside one (jobs, scripts, tests). */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** User agents are free text of any length; keep enough to recognise the device. */
export const USER_AGENT_MAX = 200;
