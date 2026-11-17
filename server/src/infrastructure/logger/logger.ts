import type { IncomingMessage, ServerResponse } from "node:http";
import pino from "pino";
import pinoHttp from "pino-http";
import { SERVICE_NAME } from "../../config/constants";
import { env } from "../../config/env";

/**
 * The only logger (Backend Guide §29.3). Objects first, message second:
 * `logger.warn({ err, orderId }, "reminder skipped")`. Never log secrets or tokens.
 */
export const logger = pino({
  level: env.logLevel,
  base: { service: SERVICE_NAME },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.authorization",
      "*.cookie",
      "*.token",
      "*.idToken",
      "*.password",
      "*.email",
      "*.phone",
    ],
    censor: "[redacted]",
  },
  ...(env.isDevelopment
    ? { transport: { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname,service" } } }
    : {}),
});

type RequestWithId = IncomingMessage & { requestId?: string; originalUrl?: string };

/** One line per request: `GET /api/v1/customers 200 (41 ms)`. /health is not logged. */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as RequestWithId).requestId ?? "",
  autoLogging: { ignore: (req) => (req.url ?? "").endsWith("/health") },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return env.isDevelopment ? "debug" : "info";
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse, responseTime: number) =>
    `${req.method} ${(req as RequestWithId).originalUrl ?? req.url} ${res.statusCode} (${Math.round(responseTime)} ms)`,
  customErrorMessage: (req: IncomingMessage, res: ServerResponse) =>
    `${req.method} ${(req as RequestWithId).originalUrl ?? req.url} ${res.statusCode}`,
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
