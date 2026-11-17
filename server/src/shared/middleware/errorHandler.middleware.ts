import type { NextFunction, Request, Response } from "express";
import { logger } from "../../infrastructure/logger/logger";
import { captureError } from "../../infrastructure/monitoring/sentry";
import { AppError } from "../errors/AppError";
import { ApiResponse } from "../response/apiResponse";

const CONNECTION_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "53300", // too_many_connections
  "08000",
  "08003",
  "08006",
]);

/** The Postgres / Node error code, wherever the driver put it. */
function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const { code, driverError } = err as { code?: unknown; driverError?: { code?: unknown } };
  if (typeof code === "string") return code;
  return typeof driverError?.code === "string" ? driverError.code : undefined;
}

function bodyParserType(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const { type } = err as { type?: unknown };
  return typeof type === "string" ? type : undefined;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json(ApiResponse.error("Route not found", 404));
}

/**
 * The single place errors become responses (Backend Guide §12.2). Only AppError
 * messages are client-safe; nothing from an unknown error reaches the client.
 */
export function globalErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(ApiResponse.error(err.message, err.statusCode, err.errors));
    return;
  }

  const type = bodyParserType(err);
  if (type === "entity.parse.failed") {
    res.status(400).json(ApiResponse.error("Malformed JSON body", 400));
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json(ApiResponse.error("Request body is too large", 413));
    return;
  }

  const code = errorCode(err);
  if (code === "23505") {
    res.status(409).json(ApiResponse.error("This record already exists", 409));
    return;
  }
  if (code === "23503") {
    res.status(422).json(ApiResponse.error("A referenced record does not exist", 422));
    return;
  }
  if (code && CONNECTION_ERRORS.has(code)) {
    logger.error({ err, requestId: req.requestId }, "dependency unavailable");
    res.setHeader("Retry-After", "30");
    res.status(503).json(ApiResponse.error("Service temporarily unavailable. Please try again shortly.", 503));
    return;
  }

  const route = `${req.method} ${req.route?.path ? req.baseUrl + String(req.route.path) : req.originalUrl.split("?")[0]}`;
  logger.error({ err, requestId: req.requestId, route, userId: req.user?.id }, "unhandled error");
  captureError(err, { requestId: req.requestId, route, userId: req.user?.id });
  res.status(500).json(ApiResponse.error("Internal server error", 500));
}
