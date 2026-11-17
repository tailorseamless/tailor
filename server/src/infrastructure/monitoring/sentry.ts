import * as Sentry from "@sentry/node";
import { SERVICE_NAME } from "../../config/constants";
import { env } from "../../config/env";

/**
 * Error monitoring (Backend Guide §29.3). Off without SENTRY_DSN and never in
 * tests. Only UNEXPECTED errors are reported (a 500, a failed job, a failed
 * start) — never request bodies, emails, tokens or IP addresses.
 */
let enabled = false;

export function initMonitoring(): void {
  if (!env.monitoring.sentryDsn || env.isTest) return;
  Sentry.init({
    dsn: env.monitoring.sentryDsn,
    environment: env.monitoring.environment,
    serverName: SERVICE_NAME,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Strip anything that might identify a person, whatever an integration added.
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
      return event;
    },
  });
  enabled = true;
}

export interface ErrorContext {
  requestId?: string;
  route?: string;
  userId?: string;
  job?: string;
}

export function captureError(err: unknown, context: ErrorContext = {}): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.requestId) scope.setTag("request_id", context.requestId);
    if (context.route) scope.setTag("route", context.route);
    if (context.job) scope.setTag("job", context.job);
    Sentry.captureException(err);
  });
}

/** Sends anything still queued; called on shutdown. Never waits longer than `timeoutMs`. */
export async function flushMonitoring(timeoutMs = 2000): Promise<void> {
  if (enabled) await Sentry.flush(timeoutMs).catch(() => undefined);
}
