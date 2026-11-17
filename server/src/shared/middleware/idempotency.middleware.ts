import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../../infrastructure/logger/logger";
import { IdempotencyService } from "../../modules/idempotency/services/idempotency.service";
import { AppError } from "../errors/AppError";
import { authUser } from "../http/request";

const VALID_KEY = /^[A-Za-z0-9_-]{8,100}$/;

/**
 * Optional `Idempotency-Key` support for create / submit endpoints that must
 * not run twice (Backend Guide §27.1). Place it after `authorise` (and any
 * upload middleware) and BEFORE `validate`.
 *
 * - A replay returns the stored response with `Idempotent-Replay: true`.
 * - The same key with a different request is a 409.
 * - Only 2xx responses are stored, and before the reply is sent, so an
 *   immediate retry is always a replay. A failed request frees its key.
 */
export async function idempotent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.get("idempotency-key");
  if (!key) {
    next();
    return;
  }
  if (!VALID_KEY.test(key)) throw AppError.badRequest("Idempotency-Key must be 8–100 URL-safe characters");

  const user = authUser(req);
  const service = IdempotencyService.Instance;
  const requestHash = createHash("sha256")
    .update(`${req.method}\n${req.originalUrl.split("?")[0]}\n${JSON.stringify(req.body ?? {})}`)
    .digest("hex");

  const outcome = await service.begin(user.id, key, requestHash);
  if ("existing" in outcome) {
    const { existing } = outcome;
    if (!existing || existing.statusCode === null) {
      throw AppError.conflict("A request with this Idempotency-Key is still being processed");
    }
    if (existing.requestHash !== requestHash) {
      throw AppError.conflict("This Idempotency-Key was already used for a different request");
    }
    res.setHeader("Idempotent-Replay", "true");
    res.status(existing.statusCode).json(existing.response);
    return;
  }

  const { reservedId } = outcome;
  let stored = false;
  const send = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 200 || res.statusCode >= 300) return send(body);
    stored = true;
    service
      .complete(reservedId, res.statusCode, body)
      .catch((err: unknown) => logger.error({ err, requestId: req.requestId }, "idempotency key not stored"))
      .finally(() => send(body));
    return res;
  }) as Response["json"];

  // Anything that did not end in a stored 2xx gives the key back.
  res.on("close", () => {
    if (stored) return;
    service
      .release(reservedId)
      .catch((err: unknown) => logger.error({ err, requestId: req.requestId }, "idempotency key not released"));
  });
  next();
}
