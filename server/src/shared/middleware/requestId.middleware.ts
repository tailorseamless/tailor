import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { runWithRequestContext, USER_AGENT_MAX } from "../context/requestContext";

const VALID_ID = /^[\w-]{8,100}$/;

/**
 * Every request gets an id (a valid incoming one is kept), echoed as X-Request-Id. The rest of the
 * request runs inside a context holding that id, the caller's address and device, for the audit trail.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get("x-request-id");
  req.requestId = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  runWithRequestContext(
    {
      requestId: req.requestId,
      ip: req.ip ?? null, // proxy-aware: app.ts sets `trust proxy`
      userAgent: req.get("user-agent")?.slice(0, USER_AGENT_MAX) ?? null,
      path: req.originalUrl.split("?")[0] ?? req.originalUrl,
    },
    next,
  );
}
