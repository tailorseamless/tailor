import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const VALID_ID = /^[\w-]{8,100}$/;

/** Every request gets an id (a valid incoming one is kept), echoed as X-Request-Id. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get("x-request-id");
  req.requestId = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
