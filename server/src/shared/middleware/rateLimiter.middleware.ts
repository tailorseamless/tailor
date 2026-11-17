import type { Request } from "express";
import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from "express-rate-limit";
import { env } from "../../config/env";
import { ApiResponse } from "../response/apiResponse";

/**
 * All limiters answer 429 in the envelope and are skipped when NODE_ENV=test
 * (Backend Guide §13.5).
 */
/** The signed-in user when there is one, else the client IP (normalised for IPv6). */
const byUser = (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? "");

function limiter(
  windowMinutes: number,
  limit: number,
  message: string,
  keyGenerator?: (req: Request) => string,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    ...(keyGenerator ? { keyGenerator } : {}),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (_req, res) => {
      res.status(429).json(ApiResponse.error(message, 429));
    },
  });
}

/** The whole API prefix: 300 requests / 5 min / IP. */
export const apiRateLimiter = limiter(5, 300, "Too many requests. Please try again shortly.");

/** Creating a business workspace: 10 / 15 min / IP. */
export const registrationRateLimiter = limiter(15, 10, "Too many sign-up attempts. Please try again later.");

/** File uploads: 30 / 15 min / user. Place after authorise. */
export const uploadRateLimiter = limiter(15, 30, "Too many uploads. Please wait a few minutes.", byUser);

/** Exports and PDFs (heavier queries): 30 / 15 min / user. */
export const exportRateLimiter = limiter(15, 30, "Too many downloads. Please wait a few minutes.", byUser);

/** The customer portal (opened by secret link): 120 / 15 min / IP. */
export const portalRateLimiter = limiter(15, 120, "Too many requests. Please try again shortly.");

/** Online appointment requests: 10 / hour / IP. */
export const bookingRateLimiter = limiter(60, 10, "Too many requests. Please try again later.");
