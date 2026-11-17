import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { idempotent } from "../../../shared/middleware/idempotency.middleware";
import { exportRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { PaymentController as P } from "../controllers/payment.controller";
import * as s from "../validators/payment.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
// Order is fixed: authorise → idempotent → validate → controller (§4.3, §27.1).
const router = Router();

router.get("/payments", authorise("payment.read"), validate(s.listPaymentsSchema), P.list);
router.get("/payments/:id/receipt", authorise("payment.read"), validate(s.paymentIdSchema), P.receipt);
router.get(
  "/payments/:id/receipt/pdf",
  authorise("payment.read"),
  exportRateLimiter,
  validate(s.paymentIdSchema),
  P.receiptPdf,
);
router.post("/payments/:id/receipt/email", authorise("payment.record"), validate(s.emailReceiptSchema), P.emailReceipt);
router.post("/payments/:id/void", authorise("payment.void"), idempotent, validate(s.voidPaymentSchema), P.void);

router.get("/orders/:orderId/payments", authorise("payment.read"), validate(s.listOrderPaymentsSchema), P.listForOrder);
router.post(
  "/orders/:orderId/payments",
  authorise("payment.record"),
  idempotent,
  validate(s.recordPaymentSchema),
  P.record,
);
router.post(
  "/orders/:orderId/refunds",
  authorise("payment.refund"),
  idempotent,
  validate(s.recordRefundSchema),
  P.refund,
);

export const paymentRoutes = router;
