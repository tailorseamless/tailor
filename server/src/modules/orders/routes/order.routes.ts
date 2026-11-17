import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { idempotent } from "../../../shared/middleware/idempotency.middleware";
import { uploadRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { uploadFiles } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { UPLOAD_LIMITS } from "../../../config/constants";
import { FILE_TYPES } from "../../../shared/utils/fileTypes";
import { OrderController as O } from "../controllers/order.controller";
import * as s from "../validators/order.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

router.get("/orders", authorise("order.read"), validate(s.listOrdersSchema), O.list);
router.post("/orders", authorise("order.create"), idempotent, validate(s.createOrderSchema), O.create);
router.get("/orders/:id", authorise("order.read"), validate(s.orderIdSchema), O.detail);
router.patch("/orders/:id", authorise("order.update"), validate(s.updateOrderSchema), O.update);
// A verb, because it is an action with rules of its own (§14).
router.post("/orders/:id/status", authorise("order.status"), validate(s.changeOrderStatusSchema), O.changeStatus);

// Reference pictures: authorise → limiter → upload → validate → controller (§20.6).
const images = uploadFiles("images", UPLOAD_LIMITS.filesPerRequest, {
  maxMb: UPLOAD_LIMITS.imageMb,
  allowed: FILE_TYPES.image,
});
router.post(
  "/orders/:id/images",
  authorise("order.update"),
  uploadRateLimiter,
  images,
  validate(s.orderIdSchema),
  O.addImages,
);
router.delete("/orders/:id/images/:imageId", authorise("order.update"), validate(s.orderImageSchema), O.removeImage);

export const orderRoutes = router;
