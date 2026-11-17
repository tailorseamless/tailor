import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { RequestController as R } from "../controllers/request.controller";
import * as s from "../validators/request.schema";

// Staff side of online requests. No authMiddleware here — it is mounted once in app.ts (§14.1).
const router = Router();

router.get("/appointment-requests", authorise("appointment.read"), validate(s.listRequestsSchema), R.list);
router.get("/appointment-requests/:id", authorise("appointment.read"), validate(s.requestIdSchema), R.detail);
router.post(
  "/appointment-requests/:id/accept",
  authorise("appointment.write"),
  validate(s.acceptRequestSchema),
  R.accept,
);
router.post(
  "/appointment-requests/:id/decline",
  authorise("appointment.write"),
  validate(s.declineRequestSchema),
  R.decline,
);

export const requestRoutes = router;
