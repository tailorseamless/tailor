import { Router } from "express";
import { bookingRateLimiter, portalRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PortalController as P } from "../controllers/portal.controller";
import * as s from "../validators/portal.schema";

/**
 * PUBLIC routes — mounted in app.ts BEFORE the auth pair (Backend Guide
 * §14.1). Every one has its own rate limiter, and answers only for the one
 * business (and customer) its link or address resolves to.
 */
const router = Router();

// The customer portal: opened by the secret link a business shares with one customer.
router.get("/portal/:token", portalRateLimiter, validate(s.portalSchema), P.view);
router.get("/portal/:token/receipts/:paymentId/pdf", portalRateLimiter, validate(s.portalReceiptSchema), P.receiptPdf);
router.post(
  "/portal/:token/appointments/:appointmentId/confirm",
  portalRateLimiter,
  validate(s.portalConfirmSchema),
  P.confirmAppointment,
);
router.post("/portal/:token/appointment-requests", bookingRateLimiter, validate(s.portalRequestSchema), P.request);

// A business's public page: <APP_URL>/<slug>, once the business has published it.
router.get("/public/businesses/:slug", portalRateLimiter, validate(s.shopPageSchema), P.shopPage);
router.post(
  "/public/businesses/:slug/appointment-requests",
  bookingRateLimiter,
  validate(s.bookingRequestSchema),
  P.bookingRequest,
);

export const publicPortalRoutes = router;
